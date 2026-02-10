
import { useEffect } from 'react';
import { Viewer, CameraEventType, Color } from 'cesium';
import { QualitySettings } from '../../../types';
import { isMobileDevice, isAndroidDevice } from '../utils/performance';

/**
 * Manages Quality, Performance and Device-specific settings for the Cesium Viewer
 */
export function useQualitySettings(viewer: Viewer | null, qualitySettings: QualitySettings | undefined) {
    const isMobile = isMobileDevice();
    const isAndroid = isAndroidDevice();

    // Initialize Optimizations (Run Once)
    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;
        const scene = viewer.scene;
        if (!scene || scene.isDestroyed()) return;

        // Mobile Inputs
        const controller = scene.screenSpaceCameraController;
        if (controller) {
            controller.enableTranslate = true;
            controller.enableZoom = true;
            controller.enableRotate = true;
            controller.enableTilt = true;
            controller.enableLook = true;

            if (isMobile) {
                controller.enableInputs = true;
                controller.inertiaSpin = 0.9;
                controller.inertiaTranslate = 0.9;
                controller.inertiaZoom = 0.8;
            } else {
                controller.enableInputs = true;
                controller.translateEventTypes = [CameraEventType.LEFT_DRAG];
            }
        }

        // Globe / Scene Settings
        if (scene.globe && !scene.globe.isDestroyed()) {
            if (isAndroid) {
                scene.globe.depthTestAgainstTerrain = true;
                scene.globe.enableLighting = false;
                scene.globe.tileCacheSize = 250;
                scene.globe.maximumScreenSpaceError = 3;
                scene.globe.preloadAncestors = false;
                scene.globe.preloadSiblings = false;

                if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
                scene.fog.enabled = false;
                scene.highDynamicRange = false;
                scene.globe.showGroundAtmosphere = false;
                try { (scene as any).orderIndependentTranslucency = false; } catch (_e) { /* getter-only in some Cesium versions */ }
                scene.globe.baseColor = Color.BLUE;
                scene.globe.show = true;
                if (scene.skyBox) scene.skyBox.show = true;

                if (scene.camera && (scene.camera.frustum as any).near) {
                    (scene.camera.frustum as any).near = 100.0;
                }

                viewer.resolutionScale = 0.85;

                // Delayed renders for Android
                [100, 500].forEach(d => setTimeout(() => !scene.isDestroyed() && scene.requestRender(), d));
            } else {
                scene.globe.depthTestAgainstTerrain = true;
                scene.globe.enableLighting = false;
                scene.globe.tileCacheSize = isMobile ? 500 : 1000;
                viewer.resolutionScale = 1.0;
                if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
            }

            // Optimize Tile Provider - only set safe properties
            if ((scene.globe as any)._surface && !(scene.globe as any)._surface.isDestroyed?.()) {
                // NOTE: Do NOT set _debug = false, it breaks Cesium's tile statistics
                (scene.globe as any)._surface._tileProvider._levelZeroMaximumGeometricError = isMobile ? 2000.0 : 1000.0;
            }
        }

        if (!scene.isDestroyed()) {
            scene.logarithmicDepthBuffer = !isAndroid;

            if (!isMobile) {
                scene.requestRenderMode = false;
            } else {
                scene.requestRenderMode = false;
                scene.maximumRenderTimeChange = Number.POSITIVE_INFINITY;
            }

            if (scene.shadowMap && !(scene.shadowMap as any).isDestroyed?.()) {
                scene.shadowMap.enabled = false;
            }
        }

        // Desktop Request Render Mode Delay
        let timeoutId: number | null = null;
        if (!isMobile) {
            timeoutId = window.setTimeout(() => {
                if (!viewer.isDestroyed() && !scene.isDestroyed()) {
                    scene.requestRenderMode = true;
                    scene.maximumRenderTimeChange = Infinity;
                }
            }, 2000);
        }

        // Mobile WebGL Init
        if (isMobile) {
            try {
                const context = (scene as any).context;
                if (context && !context.isDestroyed?.()) {
                    scene.requestRender();
                    if (context.textureCache) {
                        context.textureCache.maximumSize = isAndroid ? 32 * 1024 * 1024 : 128 * 1024 * 1024;
                    }
                    if (isAndroid) {
                        [50, 150, 300, 500, 1000, 2000].forEach(d => setTimeout(() => {
                            try {
                                if (!scene.isDestroyed() && scene.globe) {
                                    scene.requestRender();
                                    if ((scene.globe as any)._surface && (scene.globe as any)._surface._tilesToRender) {
                                        (scene.globe as any)._surface._tilesToRender.length = 0;
                                    }
                                }
                            } catch (e) { }
                        }, d));
                    }
                }
            } catch (e) { }
        }

        // Desktop Texture Cache
        const context = (scene as any).context;
        if (context && !isMobile) {
            context.textureCache.maximumSize = 512 * 1024 * 1024;
            // NOTE: Removed custom generateMipmap override - it used invalid WebGL constants
        }

        scene.fog.enabled = false;

        return () => {
            if (timeoutId !== null) clearTimeout(timeoutId);
        }

    }, [viewer]);


    // Apply Quality Settings Updates
    useEffect(() => {
        if (!viewer || viewer.isDestroyed() || !qualitySettings) return;
        const scene = viewer.scene;
        if (!scene || scene.isDestroyed()) return;

        if (scene.globe && !scene.globe.isDestroyed()) {
            const safeTileCache = isAndroid
                ? Math.max(qualitySettings.tileCacheSize, 300)
                : qualitySettings.tileCacheSize;
            scene.globe.tileCacheSize = safeTileCache;

            let newGlobeSSE;
            if (isAndroid) {
                newGlobeSSE = qualitySettings.maximumScreenSpaceError <= 4 ? 2 : 4;
            } else {
                if (qualitySettings.maximumScreenSpaceError <= 1) newGlobeSSE = 0.5;
                else if (qualitySettings.maximumScreenSpaceError <= 2) newGlobeSSE = 1;
                else if (qualitySettings.maximumScreenSpaceError <= 4) newGlobeSSE = 2;
                else newGlobeSSE = 4;
            }
            scene.globe.maximumScreenSpaceError = newGlobeSSE;

            if (!isAndroid && qualitySettings.maximumScreenSpaceError <= 2) {
                scene.globe.preloadAncestors = true;
                scene.globe.preloadSiblings = true;
            } else {
                scene.globe.preloadAncestors = false;
                scene.globe.preloadSiblings = false;
            }

            // Force refresh
            try {
                if ((scene.globe as any)._surface && (scene.globe as any)._surface._tilesToRender) {
                    (scene.globe as any)._surface._tilesToRender.length = 0;
                }
                const layers = scene.imageryLayers;
                if (layers && layers.length > 0) {
                    for (let i = 0; i < layers.length; i++) {
                        const l = layers.get(i);
                        if (l) {
                            const a = l.alpha;
                            l.alpha = a * 0.999;
                            setTimeout(() => { if (!scene.isDestroyed()) l.alpha = a; }, 100);
                        }
                    }
                }
            } catch (e) { }
        }

        const context = (scene as any).context;
        if (context && context.textureCache) {
            context.textureCache.maximumSize = qualitySettings.textureCacheSize * 1024 * 1024;
        }

        scene.requestRender();
        setTimeout(() => !scene.isDestroyed() && scene.requestRender(), 200);

    }, [viewer, qualitySettings]);
}
