// This hook is no longer needed - viewer is managed directly in CesiumViewer.tsx
// Kept for backwards compatibility in case other files import it

import { Viewer } from 'cesium';

export interface UseCesiumViewerResult {
    viewerRef: null; // Deprecated
    viewerReady: boolean;
    setViewerReady: (ready: boolean) => void;
    viewerInstance: Viewer | null;
}

/**
 * @deprecated This hook is deprecated. Viewer is now managed directly in CesiumViewer.tsx
 */
export function useCesiumViewer(): UseCesiumViewerResult {
    console.warn('[useCesiumViewer] This hook is deprecated. Viewer is managed directly in CesiumViewer.tsx');
    return {
        viewerRef: null,
        viewerReady: false,
        setViewerReady: () => { },
        viewerInstance: null
    };
}
