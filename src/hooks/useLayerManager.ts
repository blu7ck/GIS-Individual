import { useState } from 'react';
import { AssetLayer, LayerType, StorageConfig, Project } from '../types';
import { deleteAsset } from '../services/assetService';
import { NotificationType } from '../components/common/Notification';

export function useLayerManager(
    assets: AssetLayer[],
    projects: Project[],
    setAssets: React.Dispatch<React.SetStateAction<AssetLayer[]>>,
    storageConfig: StorageConfig | null,
    notify: (msg: string, type: NotificationType) => void,
    setActiveModelLayer: (layer: AssetLayer | null) => void,
    setActivePotreeLayer: (layer: AssetLayer | null) => void,
    setStorageRefreshKey?: React.Dispatch<React.SetStateAction<number>>
) {
    const [flyToLayerId, setFlyToLayerId] = useState<string | null>(null);

    const handleLayerClick = (layerId: string) => {
        const layer = assets.find(a => a.id === layerId);
        if (!layer) return;

        // GLTF - Uncoordinated
        if (layer.type === LayerType.GLB_UNCOORD) {
            setActiveModelLayer(layer);
            return;
        }

        // POTREE or LAS - Point Cloud
        if (layer.type === LayerType.POTREE || layer.type === LayerType.LAS) {
            setActivePotreeLayer(layer);
            return;
        }

        // DXF/SHP/KML/Tiles all behave similarly for visibility toggle + flyTo

        if (!layer.visible) {
            setAssets(prev => prev.map(a =>
                a.id === layerId ? { ...a, visible: true } : a
            ));

            // Set flyTo immediately or with slight delay if we want to ensure visibility toggle state reaches Cesium
            // But we removed the timeout clearing, useLayers will clear it.
            setFlyToLayerId(layerId);
        } else {
            setFlyToLayerId(layerId);
        }
    };

    const handleToggleLayer = (id: string) => {
        setAssets(prev => prev.map(a =>
            a.id === id ? { ...a, visible: !a.visible } : a
        ));
    };

    const handleToggleAllLayers = (projectId: string, visible: boolean) => {
        // Get all assets for this project (including measurements)
        const projectAssets = assets.filter(a => a.project_id === projectId);
        const assetIds = projectAssets.map(a => a.id);

        // Also include measurement sub-projects
        const measurementSubProjects = projects.filter(p =>
            p.parent_project_id === projectId && p.is_measurements_folder
        );
        const measurementProjectIds = measurementSubProjects.map(p => p.id);
        const measurementAssets = assets.filter(a =>
            measurementProjectIds.includes(a.project_id)
        );
        const measurementAssetIds = measurementAssets.map(a => a.id);

        // Toggle all asset IDs
        const allAssetIds = [...assetIds, ...measurementAssetIds];

        setAssets(prev => prev.map(a =>
            allAssetIds.includes(a.id) ? { ...a, visible } : a
        ));
    };

    const handleDeleteLayer = async (id: string) => {
        // Confirmation handles by UI


        const asset = assets.find(a => a.id === id);
        if (!asset) return;

        const result = await deleteAsset(asset, storageConfig);

        if (result.success) {
            setAssets(prev => prev.filter(a => a.id !== id));
            setStorageRefreshKey?.(prev => prev + 1);
            notify("Layer deleted", "success");
        } else {
            notify(result.error || 'Failed to delete asset', 'error');
        }
    };

    return {
        flyToLayerId,
        setFlyToLayerId,
        handleLayerClick,
        handleToggleLayer,
        handleToggleAllLayers,
        handleDeleteLayer
    };
}
