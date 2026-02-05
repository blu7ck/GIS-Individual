import { useEffect, useRef } from 'react';
import { Viewer, UrlTemplateImageryProvider } from 'cesium';
import { MapType } from '../../../../types';
import { createImageryProvider } from './createImageryProvider';
import { logger } from '../../../../utils/logger';

/**
 * Hook to manage imagery layers on the Cesium Viewer
 */
export function useImagery(
    viewer: Viewer | null,
    mapType: MapType
) {
    const currentTypeRef = useRef<MapType | null>(null);
    const initialLoadDone = useRef(false);

    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        // Skip if already set to the same type
        if (currentTypeRef.current === mapType && initialLoadDone.current) return;

        let mounted = true;

        const updateLayer = async () => {
            try {
                logger.info(`[useImagery] Loading imagery for mapType: ${mapType}`);

                const provider = await createImageryProvider(mapType);

                if (!mounted || !viewer || viewer.isDestroyed()) return;

                // Remove existing layers
                viewer.imageryLayers.removeAll();

                if (provider) {
                    viewer.imageryLayers.addImageryProvider(provider);
                    currentTypeRef.current = mapType;
                    initialLoadDone.current = true;
                    logger.info(`[useImagery] Imagery layer added: ${mapType}`);

                    // Specific logic for terrain map type
                    if (mapType === MapType.TERRAIN_3D) {
                        viewer.scene.globe.depthTestAgainstTerrain = true;
                    }
                } else {
                    // Provider failed, add fallback directly
                    logger.warn('[useImagery] Provider was null, adding fallback OSM directly');
                    const fallback = new UrlTemplateImageryProvider({
                        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                        subdomains: ['a', 'b', 'c'],
                        maximumLevel: 19
                    });
                    viewer.imageryLayers.addImageryProvider(fallback);
                    initialLoadDone.current = true;
                }
            } catch (error) {
                logger.error('[useImagery] Error updating imagery layer', error);

                // Last resort fallback
                if (viewer && !viewer.isDestroyed() && viewer.imageryLayers.length === 0) {
                    try {
                        const fallback = new UrlTemplateImageryProvider({
                            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                            subdomains: ['a', 'b', 'c'],
                            maximumLevel: 19
                        });
                        viewer.imageryLayers.addImageryProvider(fallback);
                        logger.info('[useImagery] Applied last resort fallback imagery');
                    } catch (e) {
                        logger.error('[useImagery] Even fallback failed', e);
                    }
                }
            }
        };

        void updateLayer();

        return () => {
            mounted = false;
        };
    }, [viewer, mapType]);
}
