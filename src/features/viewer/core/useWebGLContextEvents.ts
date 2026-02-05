import { useEffect } from 'react';
import * as Cesium from 'cesium';
import { logger } from '../../../../utils/logger';

/**
 * Hook to handle WebGL context lost/restored events
 * Prevents the application from crashing silently and provides logging
 */
export function useWebGLContextEvents(viewer: Cesium.Viewer | null) {
    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        const handleContextLost = (event: Event) => {
            event.preventDefault();
            logger.error('WebGL context lost. The application might need to be reloaded.', {
                component: 'CesiumViewer',
                timestamp: new Date().toISOString()
            });
        };

        const handleContextRestored = () => {
            logger.info('WebGL context restored.', {
                component: 'CesiumViewer'
            });
            // Potentially re-initialize viewer or reload scene if needed
        };

        const canvas = viewer.scene.canvas;
        if (canvas) {
            canvas.addEventListener('webglcontextlost', handleContextLost, false);
            canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
        }

        return () => {
            if (canvas) {
                canvas.removeEventListener('webglcontextlost', handleContextLost);
                canvas.removeEventListener('webglcontextrestored', handleContextRestored);
            }
        };
    }, [viewer]);
}
