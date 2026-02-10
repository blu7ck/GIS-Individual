import React, { useState, useMemo } from 'react';
import CesiumViewer from '../../CesiumViewer';
import { EngineeringLayout } from '../../components/layout/EngineeringLayout';
import { PotreeViewer } from '../../features/viewer/components/PotreeViewer';
import { UncoordinatedModelViewer } from '../../components/viewer/UncoordinatedModelViewer';
import { useSecureAuth } from '../../features/secure-viewer/hooks/useSecureAuth';
import { SecureLoginForm as LoginForm } from '../../features/secure-viewer/components/SecureLoginForm';

import type { PopupType } from '../../hooks/useUIState';
import {
  Project,
  AssetLayer,
  LayerType,
  MapType,
  SceneViewMode,
  MeasurementMode,
  getDefaultQualitySettings,
} from '../../types';
import { useGeolocation } from '../../hooks/useGeolocation';

interface Props {
  shareId: string;
  workerUrl: string;
}

export const SecureViewer: React.FC<Props> = ({ shareId, workerUrl }) => {
  // --- Authentication & Data ---
  const {
    isAuthenticated,
    isLoading,
    error,
    handleUnlock,
    setIsAuthenticated
  } = useSecureAuth(shareId, workerUrl);

  // --- State ---
  const [layers, setLayers] = useState<AssetLayer[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Viewer Mode & Overlays
  const [viewMode, setViewMode] = useState<'map' | 'potree' | 'model'>('map');
  const [activePotreeLayerId, setActivePotreeLayerId] = useState<string | null>(null);
  const [activeModelLayerId, setActiveModelLayerId] = useState<string | null>(null);

  // Map State
  const [mapType, setMapType] = useState<MapType>(MapType.SATELLITE);
  const [sceneMode, setSceneMode] = useState<SceneViewMode>(SceneViewMode.SCENE3D);
  const [qualitySettings, setQualitySettings] = useState(() => getDefaultQualitySettings());

  // UI State
  const [activePopup, setActivePopup] = useState<PopupType>('none');
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>(MeasurementMode.NONE);
  const [isPlacingOnMap, setIsPlacingOnMap] = useState<string | null>(null);

  // Camera / Location
  const [flyToLayerId, setFlyToLayerId] = useState<string | null>(null);
  const geolocation = useGeolocation();

  // --- Derived State ---

  // Create a dummy project to hold the shared layers
  const sharedProject: Project = useMemo(() => ({
    id: 'shared-project',
    name: 'Paylaşılan Dosyalar',
    description: 'Size paylaşılan güvenli içerik',
    created_at: new Date().toISOString(),
    owner_id: 'shared',
  }), []);

  const projects = useMemo(() => [sharedProject], [sharedProject]);

  // Filter layers for specific viewers
  const pointCloudLayers = useMemo(() =>
    layers.filter(l => l.type === LayerType.POTREE || l.type === LayerType.LAS),
    [layers]);

  const modelLayers = useMemo(() =>
    layers.filter(l => l.type === LayerType.GLB_UNCOORD),
    [layers]);

  // --- Handlers ---

  const handleVerifyPin = async (pin: string): Promise<boolean> => {
    const loadedLayers = await handleUnlock(pin);
    if (loadedLayers) {
      setLayers(loadedLayers);
      setIsAuthenticated(true);
      setActiveProjectId('shared-project');

      // --- Smart Auto-Open Logic ---
      const pcs = loadedLayers.filter(l => l.type === LayerType.POTREE || l.type === LayerType.LAS);
      const mdls = loadedLayers.filter(l => l.type === LayerType.GLB_UNCOORD);
      const mapAssets = loadedLayers.filter(l =>
        l.type === LayerType.TILES_3D ||
        l.type === LayerType.GEOJSON ||
        l.type === LayerType.KML
      );

      // Scenario 1: Only Point Clouds -> Open Potree
      if (pcs.length > 0 && mdls.length === 0 && mapAssets.length === 0) {
        setViewMode('potree');
        if (pcs[0]) setActivePotreeLayerId(pcs[0].id);
      }
      // Scenario 2: Only Models -> Open Model Viewer
      else if (mdls.length > 0 && pcs.length === 0 && mapAssets.length === 0) {
        setViewMode('model');
        if (mdls[0]) setActiveModelLayerId(mdls[0].id);
      }
      // Scenario 3: Mixed or Map Assets -> Open Map
      else {
        setViewMode('map');
        const firstMapAsset = mapAssets[0];
        if (mapAssets.length === 1 && firstMapAsset?.position) {
          setTimeout(() => setFlyToLayerId(firstMapAsset.id), 1000);
        }
      }

      return true;
    }
    return false;
  };

  const handleLayerToggle = (id: string) => {
    setLayers(prev => prev.map(l =>
      l.id === id ? { ...l, visible: !l.visible } : l
    ));
  };

  const handleLayerClick = (id: string) => {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;

    if (layer.type === LayerType.POTREE || layer.type === LayerType.LAS) {
      setViewMode('potree');
      setActivePotreeLayerId(layer.id);
    } else if (layer.type === LayerType.GLB_UNCOORD) {
      setViewMode('model');
      setActiveModelLayerId(layer.id);
    } else if (layer.position) {
      setFlyToLayerId(id);
    }
  };

  // --- Render ---

  if (!isAuthenticated) {
    return (
      <LoginForm
        isLoading={isLoading}
        error={error}
        onVerifyPin={handleVerifyPin}
      />
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">

      {/*
        Engineering Layout handles the left panel, tools (conditional),
        right panel (settings), and overlays.
      */}
      <EngineeringLayout
        // Data
        projects={projects}
        assets={layers}
        selectedProjectId={activeProjectId}

        // Mode Flags
        isSecureMode={true}
        isViewerMode={false}
        sceneMode={sceneMode}
        setSceneMode={setSceneMode}

        // Actions
        onSelectProject={setActiveProjectId}
        onCreateProject={() => { }}
        onDeleteProject={() => { }}
        onShareProject={() => { }}

        // Layer Actions
        onLayerClick={handleLayerClick}
        onToggleLayer={handleLayerToggle}
        onDeleteLayer={() => { }}
        onShareLayer={() => { }}
        onToggleAllLayers={(_pid, vis) => {
          setLayers(prev => prev.map(l => ({ ...l, visible: vis })));
        }}

        // Asset Actions
        onOpenModelViewer={(layer) => {
          setViewMode('model');
          setActiveModelLayerId(layer.id);
        }}

        // Upload (Disabled)
        onUpload={() => { }}
        onFolderUpload={() => { }}
        onUrlAdd={() => { }}
        onCancelUpload={() => { }}
        isUploading={false}
        uploadProgressPercent={0}

        // UI State
        activePopup={activePopup}
        setActivePopup={setActivePopup}
        measurementMode={measurementMode}
        setMeasurementMode={setMeasurementMode}

        // Map State
        mapType={mapType}
        setMapType={setMapType}
        qualitySettings={qualitySettings}
        setQualitySettings={setQualitySettings}

        // Location
        isTracking={geolocation.isTracking}
        onStartTracking={geolocation.startTracking}
        onStopTracking={geolocation.stopTracking}
        hasPosition={!!geolocation.position}
        onFlyToLocation={() => { }}
        onFlyToComplete={() => setFlyToLayerId(null)}
        positioningLayerId={null}
        setPositioningLayerId={() => { }}
        mouseCoordinates={null}
        cameraHeight={0}
        viewer={null}
        isPlacingOnMap={isPlacingOnMap}
        setIsPlacingOnMap={setIsPlacingOnMap}
      >
        <CesiumViewer
          layers={layers}
          measurementMode={measurementMode}
          onMeasurementResult={() => { }}
          flyToLayerId={flyToLayerId}
          mapType={mapType}
          sceneMode={sceneMode}
          qualitySettings={qualitySettings}
          userLocation={geolocation.position}
          showUserLocation={geolocation.isTracking}
          className="w-full h-full"
        />
      </EngineeringLayout>

      {/* Overlays for different View Modes */}

      {viewMode === 'potree' && (
        <PotreeViewer
          layers={pointCloudLayers}
          initialLayerId={activePotreeLayerId || undefined}
          onClose={() => setViewMode('map')}
        />
      )}

      {viewMode === 'model' && (
        <UncoordinatedModelViewer
          layers={modelLayers}
          initialLayerId={activeModelLayerId || undefined}
          onClose={() => setViewMode('map')}
        />
      )}

    </div>
  );
};