import React, { useState, useEffect, useMemo } from 'react';
import CesiumViewer from './CesiumViewer';
import { Auth } from './components/Auth';
import { ShareModal } from './components/ShareModal';
import { ShareProjectModal } from './components/ShareProjectModal';
import { SecureViewer } from './components/SecureViewer';
import { NotificationContainer } from './components/Notification';
import { AssetLayer, MeasurementMode, QualitySettings, getDefaultQualitySettings, QualityLevel, MapType, SceneViewMode, LayerType } from './types';
import { useGeolocation } from './hooks/useGeolocation';

// New Hooks
import { useAppAuth } from './src/hooks/useAppAuth';
import { useUIState } from './src/hooks/useUIState';
import { useProjectData } from './src/hooks/useProjectData';
import { useFileUpload } from './src/hooks/useFileUpload';
import { useSharing } from './src/hooks/useSharing';
import { useLayerManager } from './src/hooks/useLayerManager';

// New Components
import { EngineeringLayout } from './src/components/layout/EngineeringLayout';
import { PopupContainer } from './src/components/layout/PopupContainer';
import { PotreeViewer } from './src/features/viewer/components/PotreeViewer';

// Global Cesium Def
if (typeof window !== 'undefined') {
  (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.136/Build/Cesium/';
}

const App: React.FC = () => {
  // 1. UI & Routing State
  const {
    isViewerMode,
    shareId,
    activePopup,
    setActivePopup,

    setShowSettings,
    activeModelLayer: _activeModelLayer,
    setActiveModelLayer: _setActiveModelLayer,
    notifications,
    notify,
    dismissNotification
  } = useUIState();

  // 2. Auth State
  const { user, handleLogin } = useAppAuth(notify);

  // 3. Storage Config (Env)
  const [storageConfig, setStorageConfig] = useState<{ workerUrl: string; supabaseUrl: string; supabaseKey: string } | null>(null);

  useEffect(() => {
    const envConfig = {
      workerUrl: import.meta.env.VITE_WORKER_URL || '',
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
      supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    };
    if (envConfig.workerUrl || envConfig.supabaseUrl || envConfig.supabaseKey) {
      setStorageConfig(envConfig);
    }
  }, []);

  // 4. Data State (Projects & Assets)
  const {
    projects,
    assets,
    setAssets,
    selectedProjectId,
    setSelectedProjectId,
    handleCreateProject,
    handleDeleteProject
  } = useProjectData(user, storageConfig, notify);

  // 5. Feature Hooks
  const {
    isUploading,
    uploadProgress,
    uploadProgressPercent,
    handleFileUpload,
    handleFolderUpload,
    handleUrlAdd
  } = useFileUpload(selectedProjectId, storageConfig, setAssets, notify, setShowSettings);

  const {
    sharingAsset,
    setSharingAsset,
    sharingProject,
    setSharingProject,
    handleShareLayer,
    handleShareProject,
    executeShare,
    executeProjectShare
  } = useSharing(storageConfig, notify);

  const [activePotreeLayer, setActivePotreeLayer] = useState<AssetLayer | null>(null);

  const {
    flyToLayerId,
    handleLayerClick,
    handleToggleLayer,
    handleToggleAllLayers,
    handleDeleteLayer
  } = useLayerManager(assets, projects, setAssets, storageConfig, notify, _setActiveModelLayer, setActivePotreeLayer);

  // 6. Map State
  const [mapType, setMapType] = useState<MapType>(MapType.TERRAIN_3D);
  const [sceneMode, setSceneMode] = useState<SceneViewMode>(SceneViewMode.SCENE3D);
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>(MeasurementMode.NONE);
  const [activeTilesetId, setActiveTilesetId] = useState<string | null>(null);

  // Quality Settings
  const [qualitySettings] = useState<QualitySettings>(() => {
    const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);
    const isMobile = typeof window !== 'undefined' && (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
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

  // Geolocation
  const geolocation = useGeolocation();
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [flyToUserLocation, setFlyToUserLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number, accuracy: number, heading: number | null } | null>(null);

  useEffect(() => {
    if (geolocation.position) {
      setUserLocation({
        lat: geolocation.position.lat,
        lng: geolocation.position.lng,
        accuracy: geolocation.position.accuracy,
        heading: geolocation.position.heading
      });
      if (!showUserLocation) setShowUserLocation(true);
    }
  }, [geolocation.position, showUserLocation]);

  // 7. Mouse & Camera State for Status Bar
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number; height: number } | null>(null);
  const [cameraHeight, setCameraHeight] = useState(10000);

  // Memoize Handlers for CesiumViewer to prevent unnecessary re-renders
  const handleTilesetClick = useMemo(() => {
    return (layerId: string) => setActiveTilesetId(layerId);
  }, []);

  const handleHeightOffsetChange = useMemo(() => {
    return (layerId: string, offset: number) => {
      setAssets(prev => prev.map(a => a.id === layerId ? { ...a, heightOffset: offset } : a));
    };
  }, [setAssets]);

  const handleCameraChange = useMemo(() => {
    return (h: number, _head: number, _p: number, _z: number) => {
      // Only update if difference is significant to avoid jitter cycles
      setCameraHeight(prev => Math.abs(prev - h) > 1 ? h : prev);
    };
  }, []);

  // Throttled mouse update
  const handleMouseMove = useMemo(() => {
    let lastCall = 0;
    return (coords: { lat: number; lng: number; height: number }) => {
      const now = Date.now();
      if (now - lastCall > 100) { // Throttle to 100ms (10fps) for UI updates
        setMouseCoords(coords);
        lastCall = now;
      }
    };
  }, []);

  // --- Render ---

  // 1. Unauthenticated or Viewer Mode
  if (!user && !isViewerMode) {
    return (
      <>
        <Auth onLogin={handleLogin} />
        <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />
      </>
    );
  }

  // 2. Viewer Mode (Shared Link)
  if (isViewerMode && shareId) {
    return (
      <SecureViewer
        shareId={shareId}
        workerUrl={storageConfig?.workerUrl || ''}
      />
    );
  }

  // 3. Main App Layout (Engineering)
  return (
    <div className="relative w-full h-full bg-engineering-bg">
      <EngineeringLayout
        // Data
        projects={projects}
        assets={assets}
        selectedProjectId={selectedProjectId}
        // Actions
        onSelectProject={setSelectedProjectId}
        onCreateProject={() => handleCreateProject('New Project')}
        onDeleteProject={handleDeleteProject}
        onShareProject={handleShareProject}
        onLayerClick={handleLayerClick}
        onToggleLayer={handleToggleLayer}
        onDeleteLayer={handleDeleteLayer}
        onShareLayer={handleShareLayer}
        onToggleAllLayers={(visible: boolean) => handleToggleAllLayers(selectedProjectId || '', visible)}
        onFlyToLayer={handleLayerClick}
        onUpload={(e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFileUpload(file, LayerType.KML);
          }
        }}
        onFolderUpload={(e: React.ChangeEvent<HTMLInputElement>) => {
          const files = e.target.files;
          if (files) {
            handleFolderUpload(files, LayerType.KML);
          }
        }}
        onUrlAdd={(url: string, name: string) => handleUrlAdd(url, LayerType.TILES_3D, name)}
        // View State
        mapType={mapType}
        setMapType={setMapType}
        sceneMode={sceneMode}
        setSceneMode={setSceneMode}
        measurementMode={measurementMode}
        setMeasurementMode={setMeasurementMode}
        // Status Data
        mouseCoordinates={mouseCoords}
        cameraHeight={cameraHeight}
        onFitBounds={() => {
          // Placeholder for fit bounds
        }}
        // UI State
        activeModelLayer={activeTilesetId}
        onCloseModelViewer={() => setActiveTilesetId(null)}

        isViewerMode={isViewerMode}
        showUserLocation={showUserLocation}
        flyToUserLocation={flyToUserLocation}
        setFlyToUserLocation={setFlyToUserLocation}
      >
        <CesiumViewer
          className="w-full h-full"
          full
          sceneMode={sceneMode}
          mapType={mapType}
          layers={assets}
          flyToLayerId={flyToLayerId}
          measurementMode={measurementMode}
          onMeasurementResult={(res: string) => {
            console.log('Measurement:', res);
          }}
          onTilesetClick={handleTilesetClick}
          onHeightOffsetChange={handleHeightOffsetChange}
          userLocation={userLocation}
          showUserLocation={showUserLocation}
          flyToUserLocation={flyToUserLocation}
          onUserLocationFlyComplete={() => setFlyToUserLocation(false)}
          qualitySettings={qualitySettings}
          onMouseMove={handleMouseMove}
          onCameraChange={handleCameraChange}
        />

        {/* Potree Switch UI */}
        {activePotreeLayer && (
          <PotreeViewer
            layer={activePotreeLayer}
            onClose={() => setActivePotreeLayer(null)}
          />
        )}
      </EngineeringLayout>

      {/* Popups & Modals - Kept outside layout for overlay */}
      <PopupContainer
        activePopup={activePopup}
        setActivePopup={setActivePopup}
        measurementMode={measurementMode}
        setMeasurementMode={setMeasurementMode}
        activeTilesetId={activeTilesetId}
        onUpdateAsset={(id, name, updates) => {
          setAssets(prev => prev.map(a =>
            a.id === id ? { ...a, ...updates, name: name || a.name } : a
          ));
        }}
        assets={assets}
        selectedProjectId={selectedProjectId}
        onUpload={handleFileUpload}
        onFolderUpload={handleFolderUpload}
        onUrlAdd={handleUrlAdd}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        uploadProgressPercent={uploadProgressPercent}
      />

      {/* Share Modals */}
      {sharingAsset && (
        <ShareModal
          asset={sharingAsset}
          onClose={() => setSharingAsset(null)}
          onShare={executeShare}
        />
      )}
      {sharingProject && (
        <ShareProjectModal
          project={sharingProject}
          onClose={() => setSharingProject(null)}
          onShare={executeProjectShare}
          assets={assets.filter(a => a.project_id === sharingProject.id)}
          measurements={[]}
        />
      )}

      {/* Notification Toast */}
      <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />
    </div>
  );
};

export default App;