import { Viewer } from 'cesium';

/**
 * Apply default optimizations and settings to the viewer
 * NOTE: Keep this minimal to avoid crashes during initialization
 */
export function setupViewerDefaults(viewer: Viewer) {
    const scene = viewer.scene;

    // Disable depth test against terrain - can cause crashes without proper terrain provider
    scene.globe.depthTestAgainstTerrain = false;

    // Show atmosphere for visual polish
    scene.globe.showGroundAtmosphere = true;

    // Disable lighting for simpler rendering
    scene.globe.enableLighting = false;

    // Disable shadows completely to avoid render issues
    viewer.shadows = false;

    // Camera controller settings
    scene.screenSpaceCameraController.enableCollisionDetection = true;
    scene.screenSpaceCameraController.minimumZoomDistance = 10;

    // Hide credits container
    try {
        const creditContainer = (viewer as any).creditContainer as HTMLElement;
        if (creditContainer && creditContainer.style) {
            creditContainer.style.display = 'none';
        }
    } catch (e) {
        // Ignore if we can't hide credits
    }
}
