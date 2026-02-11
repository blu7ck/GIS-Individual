import {
    Cesium3DTileset,
    Viewer,
    Cartographic,
    Cartesian3,
    Matrix4,
    defined,
    EllipsoidTerrainProvider,
    sampleTerrainMostDetailed
} from 'cesium';
import { logger } from '../../../../utils/logger';

/**
 * Production-ready ground clamping for 3D Tilesets.
 * Samples terrain height and adjusts tileset to sit on ground.
 * Uses exponential backoff for reliable bounding sphere availability.
 */
export async function clampTilesetToGround(
    tileset: Cesium3DTileset & { _fixurelabsClampedToGround?: boolean },
    viewer: Viewer,
    retryCount = 0
): Promise<void> {
    if (tileset._fixurelabsClampedToGround) return;

    const MAX_RETRIES = 10;
    const INITIAL_RETRY_DELAY = 2000;
    const MAX_RETRY_DELAY = 15000;
    const BACKOFF_FACTOR = 1.5;

    try {
        const ts = tileset as any;

        const retryDelay = Math.min(
            INITIAL_RETRY_DELAY * Math.pow(BACKOFF_FACTOR, retryCount),
            MAX_RETRY_DELAY
        );

        // Wait for bounding sphere computation (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        if (!viewer || viewer.isDestroyed()) return;
        const scene = viewer.scene;
        if (!scene || scene.isDestroyed()) return;

        // Skip if no real terrain
        const terrainProvider = scene.terrainProvider;
        if (!terrainProvider || terrainProvider instanceof EllipsoidTerrainProvider) {
            return;
        }

        // Get bounding sphere — retry if not yet available
        const boundingSphere = tileset.boundingSphere;
        if (!boundingSphere || !defined(boundingSphere.center)) {
            if (retryCount < MAX_RETRIES) {
                return clampTilesetToGround(tileset, viewer, retryCount + 1);
            }
            return;
        }

        const center = boundingSphere.center;
        const centerCartographic = Cartographic.fromCartesian(center);

        // Sample terrain height at center point
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
            if (isNaN(terrainHeight)) {
                throw new Error('Invalid terrain height');
            }
        } catch (error) {
            if (retryCount < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return clampTilesetToGround(tileset, viewer, retryCount + 1);
            }
            return;
        }

        // Calculate offset: terrain height minus tileset bottom
        const tilesetMinHeight = centerCartographic.height - boundingSphere.radius;
        const heightOffset = terrainHeight - tilesetMinHeight;

        // Skip insignificant adjustments
        if (Math.abs(heightOffset) < 0.1) {
            ts._fixurelabsClampedToGround = true;
            return;
        }

        // Get the up direction (surface normal) at the center point
        const upVector = Cartographic.toCartesian(centerCartographic);
        const surfaceNormal = Cartesian3.normalize(upVector, new Cartesian3());

        // Scale surface normal by offset
        const worldTranslation = Cartesian3.multiplyByScalar(
            surfaceNormal, heightOffset, new Cartesian3()
        );
        const translationMatrix = Matrix4.fromTranslation(worldTranslation, new Matrix4());

        // Get current model matrix as base
        const currentMatrix = tileset.modelMatrix
            ? Matrix4.clone(tileset.modelMatrix)
            : Matrix4.IDENTITY.clone();

        // Apply: translation * currentMatrix
        const clampedMatrix = Matrix4.multiply(
            translationMatrix, currentMatrix, new Matrix4()
        );

        // Always use modelMatrix (stable for both mobile and desktop)
        tileset.modelMatrix = clampedMatrix;

        // Store base matrix for subsequent height/scale adjustments
        ts._fixurelabsBaseMatrix = Matrix4.clone(clampedMatrix);

        // Store anchor position for height direction calculations
        const anchorPosition = Matrix4.getTranslation(clampedMatrix, new Cartesian3());
        ts._fixurelabsAnchorPosition = Cartesian3.clone(anchorPosition);

        ts._fixurelabsClampedToGround = true;

        logger.info(`[Tileset] Ground clamped. Offset: ${heightOffset.toFixed(2)}m`);

        // Re-apply any existing height/scale params on top of new base
        const params = ts._fixurelabsParams || { height: 0, scale: 1.0 };
        if (params.height !== 0 || params.scale !== 1.0) {
            applyTilesetTransform(tileset, params.height, params.scale);
        }

    } catch (error) {
        logger.error('Error clamping 3D Tiles to ground', error);
    }
}

/**
 * Applies height offset and scale to a tileset.
 * Works on top of the ground-clamped base matrix.
 * Height 0 = ground level (after clamping).
 */
export function applyTilesetTransform(
    tileset: Cesium3DTileset,
    height: number,
    scale: number = 1.0
): void {
    const ts = tileset as any;

    // Store params for re-application after clamping
    ts._fixurelabsParams = { height, scale };

    // Get base matrix (set by clampTilesetToGround, or snapshot current)
    if (!ts._fixurelabsBaseMatrix) {
        ts._fixurelabsBaseMatrix = Matrix4.clone(tileset.modelMatrix);
    }
    const baseMatrix = ts._fixurelabsBaseMatrix;

    // Get anchor position for direction calculations
    if (!ts._fixurelabsAnchorPosition) {
        ts._fixurelabsAnchorPosition = Matrix4.getTranslation(baseMatrix, new Cartesian3());
    }
    const anchor = ts._fixurelabsAnchorPosition;

    // Start from base
    let resultMatrix = Matrix4.clone(baseMatrix);

    // --- Height offset along surface normal ---
    if (Math.abs(height) > 0.01) {
        const surfaceNormal = Cartesian3.normalize(
            Cartesian3.clone(anchor), new Cartesian3()
        );
        const offsetVector = Cartesian3.multiplyByScalar(
            surfaceNormal, height, new Cartesian3()
        );
        const heightTranslation = Matrix4.fromTranslation(offsetVector, new Matrix4());

        // translation * base
        resultMatrix = Matrix4.multiply(heightTranslation, resultMatrix, new Matrix4());
    }

    // --- Scale around anchor point ---
    if (Math.abs(scale - 1.0) > 0.001) {
        const negAnchor = Cartesian3.negate(anchor, new Cartesian3());
        const toOrigin = Matrix4.fromTranslation(negAnchor, new Matrix4());
        const fromOrigin = Matrix4.fromTranslation(anchor, new Matrix4());
        const scaleM = Matrix4.fromUniformScale(scale, new Matrix4());

        // T(anchor) * S * T(-anchor)
        let scaleAroundAnchor = Matrix4.multiply(scaleM, toOrigin, new Matrix4());
        scaleAroundAnchor = Matrix4.multiply(fromOrigin, scaleAroundAnchor, new Matrix4());

        // scaleAroundAnchor * currentResult
        resultMatrix = Matrix4.multiply(scaleAroundAnchor, resultMatrix, new Matrix4());
    }

    // Apply via modelMatrix (consistent for mobile + desktop)
    tileset.modelMatrix = resultMatrix;
}
