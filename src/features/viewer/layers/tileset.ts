import {
    Cesium3DTileset,
    Viewer,
    Cartographic,
    Cartesian3,
    Matrix4,
    defined,
    Ellipsoid,
    EllipsoidTerrainProvider,
    sampleTerrainMostDetailed
} from 'cesium';
import { logger } from '../../../../utils/logger';

/**
 * Production-ready ground clamping function for 3D Tilesets
 * Samples terrain height and adjusts tileset position to sit on ground
 */
export async function clampTilesetToGround(
    tileset: Cesium3DTileset & { _fixurelabsClampedToGround?: boolean },
    viewer: Viewer,
    retryCount = 0
): Promise<void> {
    // Prevent multiple clamps
    if (tileset._fixurelabsClampedToGround) return;

    const MAX_RETRIES = 10;
    const INITIAL_RETRY_DELAY = 1000;
    const MAX_RETRY_DELAY = 10000;
    const BACKOFF_FACTOR = 1.5;

    try {
        const ts = tileset as any;

        if (ts.readyPromise) {
            await ts.readyPromise;
        }

        const retryDelay = Math.min(
            INITIAL_RETRY_DELAY * Math.pow(BACKOFF_FACTOR, retryCount),
            MAX_RETRY_DELAY
        );

        if (!ts.ready) {
            if (retryCount < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return clampTilesetToGround(tileset, viewer, retryCount + 1);
            }
            return;
        }

        if (!viewer || viewer.isDestroyed()) return;
        const scene = viewer.scene;
        if (!scene || scene.isDestroyed()) return;

        const terrainProvider = scene.terrainProvider;
        if (!terrainProvider || terrainProvider instanceof EllipsoidTerrainProvider) {
            return;
        }

        const boundingSphere = tileset.boundingSphere;
        if (!boundingSphere || !defined(boundingSphere.center)) {
            if (retryCount < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return clampTilesetToGround(tileset, viewer, retryCount + 1);
            }
            return;
        }

        const center = boundingSphere.center;
        const centerCartographic = Cartographic.fromCartesian(center);

        // Cache original center for stable transformations relative to ground
        if (!ts._fixurelabsOriginalCenter) {
            ts._fixurelabsOriginalCenter = Cartesian3.clone(center);
        }

        let terrainHeight: number;
        try {
            const updatedPositions = await sampleTerrainMostDetailed(
                terrainProvider,
                [centerCartographic]
            );

            if (!updatedPositions || updatedPositions.length === 0) {
                throw new Error('Terrain sampling returned empty results');
            }
            terrainHeight = updatedPositions[0]?.height ?? 0;
            if (terrainHeight === undefined || isNaN(terrainHeight)) {
                throw new Error('Invalid terrain height');
            }
        } catch (error) {
            if (retryCount < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return clampTilesetToGround(tileset, viewer, retryCount + 1);
            }
            return;
        }

        const tilesetMinHeight = centerCartographic.height - boundingSphere.radius;
        const heightOffset = terrainHeight - tilesetMinHeight;

        // Apply clamping translation
        const surfaceNormal = scene.globe.ellipsoid.geodeticSurfaceNormal(center, new Cartesian3());
        const worldTranslation = Cartesian3.multiplyByScalar(surfaceNormal, heightOffset, new Cartesian3());
        const translationMatrix = Matrix4.fromTranslation(worldTranslation, new Matrix4());

        // Get the current model matrix
        const currentTransform = tileset.modelMatrix || Matrix4.IDENTITY;

        // Correct Order: Translation * Matrix
        const clampedMatrix = Matrix4.multiply(translationMatrix, currentTransform, new Matrix4());

        // Store FixureLabs specific metadata
        ts._fixurelabsBaseMatrix = Matrix4.clone(clampedMatrix);
        ts._fixurelabsClampedToGround = true;

        logger.info(`[Tileset] Clamped successful for ${ts.url || 'tileset'}. Base matrix stored.`);

        // Re-apply any existing transforms (height/scale) using the new base matrix
        const params = ts._fixurelabsParams || { height: 0, scale: 1.0 };
        applyTilesetTransform(tileset, params.height, params.scale);

    } catch (error) {
        logger.error('Error clamping 3D Tiles to ground', error);
    }
}

/**
 * Applies a manual height offset and scale to a tileset
 */
export function applyTilesetTransform(
    tileset: Cesium3DTileset,
    height: number,
    scale: number = 1.0
): void {
    const ts = tileset as any;

    // CRITICAL: Ensure tileset is ready before accessing boundingSphere or root
    // Accessing these properties on an unready tileset can crash Cesium (this._root is undefined)
    if (!ts.ready) {
        return;
    }

    // Store params for re-application after clamping
    ts._fixurelabsParams = { height, scale };

    // 1. Determine Center
    // Try to get cached center -> boundingSphere -> root transform
    let center = ts._fixurelabsOriginalCenter;

    if (!center) {
        if (tileset.boundingSphere && defined(tileset.boundingSphere.center)) {
            center = Cartesian3.clone(tileset.boundingSphere.center);
        } else if (tileset.root && tileset.root.transform) {
            center = Matrix4.getTranslation(tileset.root.transform, new Cartesian3());
        }

        // If we found a center, cache it
        if (center) {
            ts._fixurelabsOriginalCenter = center;
        }
    }

    if (!center) return; // Still no center, cannot transform

    // 2. Prepare Transforms
    const scaleMatrix = Matrix4.IDENTITY.clone();
    const heightMatrix = Matrix4.IDENTITY.clone();

    // Scale Logic
    if (Math.abs(scale - 1.0) > 0.001) {
        const scaleM = Matrix4.fromUniformScale(scale, new Matrix4());
        const negCenter = Cartesian3.negate(center, new Cartesian3());
        const toOrigin = Matrix4.fromTranslation(negCenter, new Matrix4());
        const fromOrigin = Matrix4.fromTranslation(center, new Matrix4());

        // Scale = Translate(C) * Scale * Translate(-C)
        Matrix4.multiply(scaleM, toOrigin, scaleMatrix); // temp = S * T(-C)
        Matrix4.multiply(fromOrigin, scaleMatrix, scaleMatrix); // Final = T(C) * temp
    }

    // Height Logic
    if (Math.abs(height) > 0.01) {
        // Use globe ellipsoid or default WGS84
        const ellipsoid = (tileset as any)._viewer?.scene.globe.ellipsoid || Ellipsoid.WGS84;
        const surfaceNormal = ellipsoid.geodeticSurfaceNormal(center, new Cartesian3());

        // Move UP/DOWN along surface normal
        const offsetVector = Cartesian3.multiplyByScalar(surfaceNormal, height, new Cartesian3());
        Matrix4.fromTranslation(offsetVector, heightMatrix);
    }

    // 3. Combine: Height * Scale
    const transformModifiers = Matrix4.multiply(heightMatrix, scaleMatrix, new Matrix4());

    // 4. Apply to Base
    // If we have a stored base matrix (from clamping), use it.
    // If NOT, use the CURRENT modelMatrix as the base (assuming it was the initial state).
    // But be careful: if we apply repeatedly to modelMatrix without a fixed base, it accumulates.
    // So we MUST establish a base if it doesn't exist.

    if (!ts._fixurelabsBaseMatrix) {
        // First time transforming? Snapshot current matrix as base.
        ts._fixurelabsBaseMatrix = Matrix4.clone(tileset.modelMatrix);
    }

    const baseMatrix = ts._fixurelabsBaseMatrix;
    const finalMatrix = Matrix4.multiply(transformModifiers, baseMatrix, new Matrix4());

    tileset.modelMatrix = finalMatrix;
}
