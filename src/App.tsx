import React, { useState, useEffect, useMemo, useRef } from 'react';
import CesiumViewer from './CesiumViewer';
import { Auth } from './components/forms/Auth';
import { ShareModal } from './components/ui/ShareModal';
import { ShareProjectModal } from './components/ui/ShareProjectModal';
import { SecureViewer } from './components/viewer/SecureViewer';
import { NotificationContainer } from './components/common/Notification';
import { AssetLayer, MeasurementMode, QualitySettings, getDefaultQualitySettings, QualityLevel, MapType, SceneViewMode, LayerType, AssetStatus } from './types';
import * as Cesium from 'cesium';
import { useGeolocation } from './hooks/useGeolocation';
import { SaveModal } from './components/ui/SaveModal';

// New Hooks
import { useAppAuth } from './hooks/useAppAuth';
import { useUIState } from './hooks/useUIState';
import { useProjectData } from './hooks/useProjectData';
import { useFileUpload } from './hooks/useFileUpload';
import { useSharing } from './hooks/useSharing';
import { useLayerManager } from './hooks/useLayerManager';

// New Components
import { EngineeringLayout } from './components/layout/EngineeringLayout';
import { PotreeViewer } from './features/viewer/components/PotreeViewer';

// Global Cesium Def
if (typeof window !== 'undefined') {
  (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.136/Build/Cesium/';
}

import { saveMeasurementAsAnnotation } from './services/measurementService';

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
    handleDeleteLayer
  } = useLayerManager(assets, projects, setAssets, storageConfig, notify, _setActiveModelLayer, setActivePotreeLayer);

  // 6. Map State
  const [mapType, setMapType] = useState<MapType>(MapType.STANDARD);
  const [sceneMode, setSceneMode] = useState<SceneViewMode>(SceneViewMode.SCENE3D);
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>(MeasurementMode.NONE);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [cesiumViewerInstance, setCesiumViewerInstance] = useState<Cesium.Viewer | null>(null);

  // 6.1 Pending & Cached Measurements
  const [pendingMeasurement, setPendingMeasurement] = useState<{ text: string; geometry: any; mode: string } | null>(null);
  const [cachedMeasurements, setCachedMeasurements] = useState<AssetLayer[]>([]);

  // ...

  const handleMeasurementResult = (text: string, geometry: any, mode: MeasurementMode) => {
    // Prevent state update if component is unmounted or in weird state
    // But since this comes from event handler, it should be fine.
    // The previous error might be due to a race cond.
    setPendingMeasurement({ text, geometry, mode });
  };

  const handleConfirmSave = async (customName: string) => {
    if (!pendingMeasurement) return;

    if (!selectedProjectId) {
      // Local caching
      const tempId = `temp-${Date.now()}`;
      const newCached: AssetLayer = {
        id: tempId,
        project_id: 'cache',
        name: `${customName} (Geçici)`,
        type: LayerType.ANNOTATION,
        storage_path: '',
        url: '',
        visible: true,
        opacity: 1,
        data: {
          text: pendingMeasurement.text,
          geometry: pendingMeasurement.geometry,
          mode: pendingMeasurement.mode // Save mode for color
        },
        status: AssetStatus.READY
      };

      setCachedMeasurements(prev => [...prev, newCached]);
      notify('Proje seçilmediği için ölçüm geçici olarak kaydedildi', 'warning');
      setPendingMeasurement(null);
      return;
    }

    // Standard Supabase save
    if (user) {
      const res = await saveMeasurementAsAnnotation(
        selectedProjectId,
        user.id,
        customName,
        pendingMeasurement.text,
        {
          ...pendingMeasurement.geometry,
          mode: pendingMeasurement.mode // Store mode inside geometry
        },
        storageConfig
      );

      if (res.success && res.data) {
        // Ensure data in state also has mode (important for local update before refresh)
        if (res.data.data) {
          res.data.data.mode = pendingMeasurement.mode;
        }
        setAssets(prev => [...prev, res.data!]);
        notify('Ölçüm başarıyla kaydedildi', 'success');
      } else if (res.error) {
        notify(res.error, 'error');
      }
    }
    setPendingMeasurement(null);
  };

  // Quality Settings
  const [qualitySettings, setQualitySettings] = useState<QualitySettings>(() => {
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
  const [flyToUserLocation, setFlyToUserLocation] = useState(0); // Timestamp of last request
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
  }, [geolocation.position]);

  // Hide location if tracking is disabled
  useEffect(() => {
    if (!geolocation.isTracking) {
      setShowUserLocation(false);
      setUserLocation(null);
    }
  }, [geolocation.isTracking]);

  // 7. Mouse & Camera State for Status Bar
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number; height: number } | null>(null);
  const [cameraHeight, setCameraHeight] = useState(10000);

  // Memoize Handlers for CesiumViewer to prevent unnecessary re-renders

  const handleHeightOffsetChange = useMemo(() => {
    return (layerId: string, offset: number) => {
      setAssets(prev => prev.map(a => a.id === layerId ? { ...a, heightOffset: offset } : a));
    };
  }, [setAssets]);

  // Update asset handler (rename, height offset, scale)
  const handleUpdateAsset = useMemo(() => {
    return (id: string, newName: string, updates?: { heightOffset?: number; scale?: number }) => {
      setAssets(prev => prev.map(a => a.id === id ? { ...a, name: newName, ...updates } : a));
    };
  }, [setAssets]);

  // Toggle all layers in a project
  const handleToggleAllLayersInProject = useMemo(() => {
    return (projectId: string, visible: boolean) => {
      setAssets(prev => prev.map(a => a.project_id === projectId ? { ...a, visible } : a));
    };
  }, [setAssets]);

  // Open viewer handler (for GLB/Potree)
  const handleOpenViewer = useMemo(() => {
    return (asset: AssetLayer) => {
      if (asset.type === LayerType.GLB_UNCOORD) {
        // TODO: Open model viewer
        console.log('Open GLB viewer for:', asset.name);
      } else if (asset.type === LayerType.POTREE || asset.type === LayerType.TILES_3D) {
        setActivePotreeLayer(asset);
      }
    };
  }, []);


  // Tiles height save handler

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

  const allLayers = useMemo(() => [...assets, ...cachedMeasurements], [assets, cachedMeasurements]);

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
    <div className="relative w-full h-screen bg-engineering-bg overflow-hidden">
      <EngineeringLayout
        // ... (rest of props)
        viewer={viewerRef.current}
        projects={projects}
        assets={assets}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onCreateProject={() => handleCreateProject('New Project')}
        onDeleteProject={handleDeleteProject}
        onShareProject={handleShareProject}
        onLayerClick={handleLayerClick}
        onToggleLayer={handleToggleLayer}
        onDeleteLayer={handleDeleteLayer}
        onShareLayer={handleShareLayer}
        onUpdateAsset={handleUpdateAsset}
        onToggleAllLayers={handleToggleAllLayersInProject}
        onOpenModelViewer={handleOpenViewer}
        sceneMode={sceneMode}
        setSceneMode={setSceneMode}
        activePopup={activePopup}
        setActivePopup={setActivePopup}
        measurementMode={measurementMode}
        setMeasurementMode={setMeasurementMode}
        onUpload={handleFileUpload}
        onFolderUpload={handleFolderUpload}
        onUrlAdd={(url, type) => handleUrlAdd(url, type, url.split('/').pop() || 'New Layer')}
        isUploading={isUploading}
        uploadProgress={typeof uploadProgress === 'number' ? `${uploadProgress}%` : uploadProgress}
        uploadProgressPercent={uploadProgressPercent}
        mapType={mapType}
        setMapType={setMapType}
        qualitySettings={qualitySettings}
        setQualitySettings={setQualitySettings}
        isTracking={geolocation.isTracking}
        onStartTracking={geolocation.startTracking}
        onStopTracking={geolocation.stopTracking}
        hasPosition={!!geolocation.position}
        mouseCoordinates={mouseCoords}
        cameraHeight={cameraHeight}
        isViewerMode={isViewerMode}
        onFlyToLocation={() => setFlyToUserLocation(Date.now())}
        viewer={cesiumViewerInstance}
      >
        <CesiumViewer
          className="w-full h-full"
          full
          sceneMode={sceneMode}
          mapType={mapType}
          layers={allLayers}
          flyToLayerId={flyToLayerId}
          measurementMode={measurementMode}
          onMeasurementResult={(text, geometry, mode) => {
            // Safe check if mode is provided
            if (mode) handleMeasurementResult(text, geometry, mode);
          }}
          onExitMeasurement={() => setMeasurementMode(MeasurementMode.NONE)}
          onHeightOffsetChange={handleHeightOffsetChange}
          userLocation={userLocation}
          showUserLocation={showUserLocation}
          flyToUserLocation={flyToUserLocation}
          onUserLocationFlyComplete={() => setFlyToUserLocation(0)}
          qualitySettings={qualitySettings}
          onMouseMove={handleMouseMove}
          onCameraChange={handleCameraChange}
          onViewerReady={setCesiumViewerInstance}
        />

        {/* Potree Switch UI */}
        {activePotreeLayer && (
          <PotreeViewer
            layer={activePotreeLayer}
            onClose={() => setActivePotreeLayer(null)}
          />
        )}
      </EngineeringLayout>


      {/* Save Modal for Naming */}
      <SaveModal
        isOpen={!!pendingMeasurement}
        onClose={() => setPendingMeasurement(null)}
        onSave={handleConfirmSave}
        defaultName={measurementMode.charAt(0) + measurementMode.slice(1).toLowerCase().replace('_', ' ')}
        measurementText={pendingMeasurement?.text || ''}
        description={!selectedProjectId ? "Bir proje seçili değil. Bu ölçüm tarayıcı belleğinde geçici olarak tutulacak." : undefined}
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