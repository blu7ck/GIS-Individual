import { Viewer, Scene, Entity, DataSource, ScreenSpaceEventHandler } from 'cesium';

/**
 * Type guard for Cesium Viewer
 */
export function isValidViewer(v: unknown): v is Viewer {
    return v !== null && v !== undefined && v instanceof Viewer && !v.isDestroyed();
}

/**
 * Type guard for Cesium Scene
 */
export function isValidScene(s: unknown): s is Scene {
    return s !== null && s !== undefined && s instanceof Scene && !s.isDestroyed();
}

/**
 * Type guard for Cesium Entity
 */
export function isValidEntity(e: unknown): e is Entity {
    return e !== null && e !== undefined && e instanceof Entity;
}

/**
 * Type guard for Cesium DataSource
 */
export function isValidDataSource(ds: unknown): ds is DataSource {
    // Check if it has entities collection which is a key characteristic of DataSource
    return (
        ds !== null &&
        ds !== undefined &&
        typeof (ds as DataSource).entities !== 'undefined'
    );
}

/**
 * Type guard for ScreenSpaceEventHandler
 */
export function isValidScreenSpaceEventHandler(h: unknown): h is ScreenSpaceEventHandler {
    return h !== null && h !== undefined && h instanceof ScreenSpaceEventHandler && !h.isDestroyed();
}
