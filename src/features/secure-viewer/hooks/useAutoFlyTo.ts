import { useState, useEffect } from 'react';
import { AssetLayer, LayerType } from '../../../../types';

export function useAutoFlyTo(
    isAuthenticated: boolean,
    layers: AssetLayer[],
    setFlyToLayerId: (id: string | null) => void,
    setLayers: React.Dispatch<React.SetStateAction<AssetLayer[]>>,
    setActiveModelLayer: (layer: AssetLayer | null) => void
) {
    const [initialFlyDone, setInitialFlyDone] = useState(false);

    useEffect(() => {
        if (!isAuthenticated || layers.length === 0 || initialFlyDone) return;

        // Auto fly to single asset if only one exists
        const viewableLayers = layers.filter(l => l.visible === false); // We set them invisible initially

        if (viewableLayers.length > 0 || layers.length > 0) {
            // Check for single GLB to auto-open
            const glbLayers = layers.filter(l =>
                l.type === LayerType.GLB_UNCOORD
            );
            if (glbLayers.length === 1) {
                // Single GLB - auto open in model viewer
                const glbLayer = glbLayers[0];
                if (glbLayer) {
                    setTimeout(() => setActiveModelLayer(glbLayer), 500);
                }
            }
            setInitialFlyDone(true);
            return;
        }

        // Priority: 3D Tiles (b3dm) > KML
        const tilesLayers = viewableLayers.filter(l => l.type === LayerType.TILES_3D);
        const kmlLayers = viewableLayers.filter(l => l.type === LayerType.KML);

        let targetLayer: AssetLayer | undefined;

        if (tilesLayers.length > 0) {
            // Prefer 3D Tiles (b3dm) - most important for building/structure visualization
            targetLayer = tilesLayers[0];
        } else if (kmlLayers.length > 0) {
            // Fallback to KML
            targetLayer = kmlLayers[0];
        }

        if (targetLayer) {
            // Make target layer visible and fly to it
            setLayers(prev => prev.map(l =>
                l.id === targetLayer!.id ? { ...l, visible: true } : l
            ));

            setFlyToLayerId(targetLayer.id);
            setInitialFlyDone(true);
        } else if (layers.length > 0) {
            // Just make all visible if no specific target
            setLayers(prev => prev.map(l => ({ ...l, visible: true })));
            setFlyToLayerId(layers[0]!.id);
            setInitialFlyDone(true);
        }
    }, [isAuthenticated, layers, initialFlyDone, setFlyToLayerId, setLayers, setActiveModelLayer]);

    return { initialFlyDone };
}
