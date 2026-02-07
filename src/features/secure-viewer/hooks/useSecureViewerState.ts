import { useState } from 'react';
import { AssetLayer, MapType, SceneViewMode, QualitySettings, getDefaultQualitySettings, QualityLevel } from '../../../types';

export function useSecureViewerState() {
    // Layer State
    const [layers, setLayers] = useState<AssetLayer[]>([]);

    // UI State
    const [projectPanelOpen, setProjectPanelOpen] = useState(true); // Open by default on desktop
    const [activePopup, setActivePopup] = useState<'none' | 'map-settings'>('none');

    // Selection State
    const [activeModelLayer, setActiveModelLayer] = useState<AssetLayer | null>(null);
    const [flyToLayerId, setFlyToLayerId] = useState<string | null>(null);
    const [activeTilesetId, setActiveTilesetId] = useState<string | null>(null);

    // Map Settings
    const [mapType, setMapType] = useState<MapType>(MapType.OPENSTREETMAP);
    const [sceneMode] = useState<SceneViewMode>(SceneViewMode.SCENE3D);

    // Quality Settings
    const [qualitySettings] = useState<QualitySettings>(() => {
        const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);
        const isMobile = typeof window !== 'undefined' && (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0)
        );

        if (isAndroid) {
            return {
                ...getDefaultQualitySettings(true),
                qualityLevel: QualityLevel.MEDIUM,
                maximumScreenSpaceError: 4,
                tileCacheSize: 250,
                textureCacheSize: 64,
                cacheBytes: 64 * 1024 * 1024,
                skipLevels: 2,
                baseScreenSpaceError: 2048,
            };
        }

        return getDefaultQualitySettings(isMobile);
    });

    const toggleLayer = (id: string) => {
        setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
    };

    return {
        layers,
        setLayers,
        projectPanelOpen,
        setProjectPanelOpen,
        activePopup,
        setActivePopup,
        activeModelLayer,
        setActiveModelLayer,
        flyToLayerId,
        setFlyToLayerId,
        activeTilesetId,
        setActiveTilesetId,
        mapType,
        setMapType,
        sceneMode,
        qualitySettings,
        toggleLayer
    };
}
