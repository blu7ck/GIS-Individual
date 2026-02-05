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
 * Production-ready ground clamping function for 3D Tilesets
 * Samples terrain height and adjusts tileset position to sit on ground
 */
export async function clampTilesetToGround(
    tileset: Cesium3DTileset & { _hekamapClampedToGround?: boolean },
    viewer: Viewer,
    retryCount = 0
): Promise<void> {
    // Prevent multiple clamps
    if (tileset._hekamapClampedToGround) return;

    const MAX_RETRIES = 10;
    const INITIAL_RETRY_DELAY = 2000;
    const MAX_RETRY_DELAY = 15000;
    const BACKOFF_FACTOR = 1.5;

    try {
        // Modern Cesium does not have readyPromise. 
        // We rely on the viewer/resium to have loaded it, or check ready.
        // Casting to any to avoid strict type mismatch if definitions are outdated/mismatched.
        const ts = tileset as any;

        if (ts.readyPromise) {
            await ts.readyPromise;
        }

        const retryDelay = Math.min(
            INITIAL_RETRY_DELAY * Math.pow(BACKOFF_FACTOR, retryCount),
            MAX_RETRY_DELAY
        );

        // Additional wait for bounding sphere
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        if (!ts.ready) {
            if (retryCount < MAX_RETRIES) {
                setTimeout(() => clampTilesetToGround(tileset, viewer, retryCount + 1), retryDelay);
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
                setTimeout(() => clampTilesetToGround(tileset, viewer, retryCount + 1), retryDelay);
            }
            return;
        }

        const center = boundingSphere.center;
        const centerCartographic = Cartographic.fromCartesian(center);

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
                setTimeout(() => clampTilesetToGround(tileset, viewer, retryCount + 1), retryDelay);
            }
            return;
        }

        const tilesetMinHeight = centerCartographic.height - boundingSphere.radius;
        const heightOffset = terrainHeight - tilesetMinHeight;

        const ADJUSTMENT_THRESHOLD = 0.1;
        if (Math.abs(heightOffset) < ADJUSTMENT_THRESHOLD) {
            return;
        }

        const currentTransform = tileset.root.computedTransform;
        const baseTransform = currentTransform
            ? Matrix4.clone(currentTransform)
            : Matrix4.IDENTITY.clone();

        const upVector = Cartographic.toCartesian(centerCartographic);
        const surfaceNormal = Cartesian3.normalize(upVector, new Cartesian3());

        const worldTranslation = Cartesian3.multiplyByScalar(
            surfaceNormal,
            heightOffset,
            new Cartesian3()
        );

        const translationMatrix = Matrix4.fromTranslation(
            worldTranslation,
            new Matrix4()
        );

        const newTransform = Matrix4.multiply(
            baseTransform,
            translationMatrix,
            new Matrix4()
        );

        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0);

        if (isMobileDevice) {
            tileset.modelMatrix = newTransform;
        } else {
            tileset.root.transform = newTransform;
        }

        // Extended properties for potential future use (scaling etc)
        (tileset as any)._hekamapBaseTransform = Matrix4.clone(newTransform);
        (tileset as any)._hekamapIsMobile = isMobileDevice;
        (tileset as any)._hekamapGroundClamped = true;

    } catch (error) {
        logger.debug('Error clamping 3D Tiles to ground', error);
    }
}
