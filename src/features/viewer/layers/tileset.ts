import {
    Cesium3DTileset,
    Viewer,
    Cartesian3,
    Matrix4,
    defined
} from 'cesium';
import { logger } from '../../../../utils/logger';

/**
 * Initializes tileset metadata for height/scale adjustments.
 * Caches center position and base matrix for use by applyTilesetTransform.
 * Does NOT reposition the tileset — georeferenced tilesets keep their original position.
 * Uses exponential backoff to wait for bounding sphere availability.
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

        // Get bounding sphere — retry if not yet available
        const boundingSphere = tileset.boundingSphere;
        if (!boundingSphere || !defined(boundingSphere.center)) {
            if (retryCount < MAX_RETRIES) {
                return clampTilesetToGround(tileset, viewer, retryCount + 1);
            }
            return;
        }

        const center = boundingSphere.center;

        // Cache the current modelMatrix as the stable base for height/scale adjustments
        ts._fixurelabsBaseMatrix = Matrix4.clone(tileset.modelMatrix);

        // Cache anchor position for surface normal direction
        ts._fixurelabsAnchorPosition = Cartesian3.clone(center);

        ts._fixurelabsClampedToGround = true;

        logger.info(`[Tileset] Metadata cached for ${ts.url || 'tileset'}. Ready for height/scale adjustments.`);

    } catch (error) {
        logger.error('Error initializing tileset metadata', error);
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
