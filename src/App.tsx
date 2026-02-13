import React, { useState, useEffect, useMemo, useCallback } from 'react';
import CesiumViewer from './CesiumViewer';
import { Auth } from './components/forms/Auth';
import { ShareModal } from './components/ui/ShareModal';
import { ShareProjectModal } from './components/ui/ShareProjectModal';
import { SecureViewer } from './components/viewer/SecureViewer';
import { NotificationContainer } from './components/common/Notification';
import { AssetLayer, MeasurementMode, QualitySettings, getDefaultQualitySettings, QualityLevel, PerformanceMode, MapType, SceneViewMode, LayerType, AssetStatus } from './types';
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
import { useParcelQuery } from './hooks/useParcelQuery';

// New Components
import { EngineeringLayout } from './components/layout/EngineeringLayout';
import { PotreeViewer } from './features/viewer/components/PotreeViewer';
import { UncoordinatedModelViewer } from './components/viewer/UncoordinatedModelViewer';
import { ParcelDetailModal } from './components/viewer/ParcelDetailModal';

// Global Cesium Def
if (typeof window !== 'undefined') {
  (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.136/Build/Cesium/';
}

import { saveMeasurementAsAnnotation } from './services/measurementService';
import { checkSupabaseConnection } from './lib/supabase';

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
    positioningLayerId,
    setPositioningLayerId,
    isPlacingOnMap,
    setIsPlacingOnMap,
    notifications,
    notify,
    dismissNotification
  } = useUIState();

  const [storageRefreshKey, setStorageRefreshKey] = useState(0);

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

      // Verify connection once on mount
      if (envConfig.supabaseUrl && envConfig.supabaseKey) {
        checkSupabaseConnection(envConfig.supabaseUrl, envConfig.supabaseKey).then(connected => {
          if (connected) {
            console.log('✅ Supabase Connected');
          } else {
            notify('Failed to connect to Supabase. Check credentials.', 'error');
          }
        });
      }
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
    handleDeleteProject,
    handleUpdateAssetMetadata,
    handleRenameAsset // Used for renaming assets
  } = useProjectData(user, storageConfig, notify, storageRefreshKey);

  // 5. Feature Hooks
  const {
    isUploading,
    uploadProgress,
    uploadProgressPercent,
    handleFileUpload,
    handleFolderUpload,
    handleUrlAdd,
    cancelUpload
  } = useFileUpload(selectedProjectId, storageConfig, setAssets, notify, setShowSettings, setStorageRefreshKey);

  const {
    sharingAsset,
    setSharingAsset,
    sharingProject,
    setSharingProject,
    executeShare,
    executeProjectShare
  } = useSharing(storageConfig, notify);

  const [activePotreeLayer, setActivePotreeLayer] = useState<AssetLayer | null>(null);

  const {
    flyToLayerId,
    setFlyToLayerId,
    handleToggleLayer,
    handleDeleteLayer
  } = useLayerManager(assets, projects, setAssets, storageConfig, notify, setActivePotreeLayer, setStorageRefreshKey);

  // 6. Map State
  const [mapType, setMapType] = useState<MapType>(MapType.STANDARD);
  const [sceneMode, setSceneMode] = useState<SceneViewMode>(SceneViewMode.SCENE3D);
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>(MeasurementMode.NONE);
  const [cesiumViewerInstance, setCesiumViewerInstance] = useState<Cesium.Viewer | null>(null);

  const parcelQuery = useParcelQuery({
    viewer: cesiumViewerInstance,
    storageConfig,
    userId: user?.id,
    onAssetsChange: () => setStorageRefreshKey(prev => prev + 1)
  });

  // Visualize Parcel Result
  useEffect(() => {
    if (!cesiumViewerInstance || !parcelQuery.currentResult) return;

    const viewer = cesiumViewerInstance;
    const { feature } = parcelQuery.currentResult;

    let addedDataSource: Cesium.DataSource | null = null;

    const load = async () => {
      try {
        // Load GeoJSON
        const lightFill = Cesium.Color.fromBytes(245, 245, 250).withAlpha(0.3);
        const ds = await Cesium.GeoJsonDataSource.load(feature, {
          stroke: Cesium.Color.BLACK,
          fill: lightFill,
          strokeWidth: 2,
          clampToGround: true
        });

        // Apply styling specifically if load options didn't fully take effect for all entity types
        ds.entities.values.forEach(entity => {
          if (entity.polygon) {
            entity.polygon.material = new Cesium.ColorMaterialProperty(lightFill);
            entity.polygon.outline = new Cesium.ConstantProperty(true);
            entity.polygon.outlineColor = new Cesium.ConstantProperty(Cesium.Color.BLACK);
            entity.polygon.outlineWidth = new Cesium.ConstantProperty(2);
            entity.polygon.classificationType = new Cesium.ConstantProperty(Cesium.ClassificationType.BOTH);
          }
          if (entity.polyline) {
            entity.polyline.material = new Cesium.ColorMaterialProperty(Cesium.Color.BLACK);
            entity.polyline.width = new Cesium.ConstantProperty(2);
            entity.polyline.clampToGround = new Cesium.ConstantProperty(true);
          }
        });

        if (!viewer.isDestroyed()) {
          viewer.dataSources.add(ds);
          addedDataSource = ds;
        }
      } catch (e) {
        console.error('Failed to visualize parcel:', e);
      }
    };

    load();

    return () => {
      if (addedDataSource && !viewer.isDestroyed()) {
        viewer.dataSources.remove(addedDataSource);
      }
    };
  }, [parcelQuery.currentResult, cesiumViewerInstance]);

  // 7.1 Active Parcel Info State
  const [activeParcelAsset, setActiveParcelAsset] = useState<AssetLayer | null>(null);
  const [activeDetailResult, setActiveDetailResult] = useState<any | null>(null);

  // 6.1 Pending & Cached Measurements
  const [pendingMeasurement, setPendingMeasurement] = useState<{ text: string; geometry: any; mode: string } | null>(null);
  const [cachedMeasurements, setCachedMeasurements] = useState<AssetLayer[]>([]);
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);

  // ...

  const handleMeasurementResult = (text: string, geometry: any, mode: MeasurementMode) => {
    // Prevent state update if component is unmounted or in weird state
    // But since this comes from event handler, it should be fine.
    // The previous error might be due to a race cond.
    setPendingMeasurement({ text, geometry, mode });
  };

  const handleConfirmSave = async (customName: string) => {
    if (!pendingMeasurement || isSavingMeasurement) return;

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
      setMeasurementMode(MeasurementMode.NONE);
      return;
    }

    // Standard Supabase save
    if (user) {
      try {
        setIsSavingMeasurement(true);
        const res = await saveMeasurementAsAnnotation(
          selectedProjectId,
          user.id,
          customName,
          pendingMeasurement.text,
          pendingMeasurement.geometry,
          pendingMeasurement.mode,
          storageConfig
        );

        if (res.success && res.data) {
          // Ensure data in state also has mode (important for local update before refresh)
          if (res.data.data) {
            res.data.data.mode = pendingMeasurement.mode;
          }
          // Strictly enforce visibility
          res.data.visible = true;

          setAssets(prev => [...prev, res.data!]);
          // Removed setStorageRefreshKey to prevent race condition/flicker
          // setStorageRefreshKey(prev => prev + 1); 
          notify('Ölçüm başarıyla kaydedildi', 'success');
        } else if (res.error) {
          notify(res.error, 'error');
        }
      } catch (error) {
        console.error('Save failed:', error);
        notify('Kaydetme hatası', 'error');
      } finally {
        setIsSavingMeasurement(false);
        setPendingMeasurement(null);
        setMeasurementMode(MeasurementMode.NONE);
      }
    }
  };

  // Quality Settings
  const [qualitySettings, setQualitySettings] = useState<QualitySettings>(() => {
    const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);

    if (isAndroid) {
      return {
        ...getDefaultQualitySettings(),
        qualityLevel: QualityLevel.MEDIUM,
        performanceMode: PerformanceMode.BALANCED,
        tileCacheSize: 250,
        textureCacheSize: 64,
        cacheBytes: 64 * 1024 * 1024,
        skipLevels: 2,
        baseScreenSpaceError: 2048,
      };
    }
    return getDefaultQualitySettings();
  });

  // Apply battery saver effects to UI
  useEffect(() => {
    if (qualitySettings.performanceMode === PerformanceMode.BATTERY_SAVER) {
      document.documentElement.classList.add('battery-saver-mode');
    } else {
      document.documentElement.classList.remove('battery-saver-mode');
    }
  }, [qualitySettings.performanceMode]);

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

  // Update asset handler (rename, height offset, scale, position)
  const handleUpdateAsset = useMemo(() => {
    return (id: string, newName: string, updates?: { heightOffset?: number; scale?: number; offsetX?: number; offsetY?: number; rotation?: number; position?: { lat: number; lng: number; height: number } }) => {
      // 1. Local Update (Optimistic)
      setAssets(prev => prev.map(a => a.id === id ? { ...a, name: newName, ...updates } : a));

      // 2. Persistence Update - Metadata
      if (updates) {
        handleUpdateAssetMetadata(id, updates);
        notify('Model ayarları güncellendi', 'success');
      }
      // 3. Persistence Update - Rename
      else if (newName) {
        handleRenameAsset(id, newName);
      }
    };
  }, [setAssets, handleUpdateAssetMetadata, handleRenameAsset]);

  // Toggle all layers in a project
  const handleToggleAllLayersInProject = useMemo(() => {
    return (projectId: string, visible: boolean) => {
      setAssets(prev => prev.map(a => a.project_id === projectId ? { ...a, visible } : a));
    };
  }, [setAssets]);

  // Open viewer handler (for GLB/Potree)
  const handleOpenViewer = useCallback((asset: AssetLayer) => {
    if (asset.type === LayerType.GLB_UNCOORD) {
      _setActiveModelLayer(asset);
    } else if (asset.type === LayerType.POTREE || asset.type === LayerType.TILES_3D || asset.type === LayerType.LAS) {
      setActivePotreeLayer(asset);
    }
  }, [_setActiveModelLayer, setActivePotreeLayer]);

  const handleShowParcelDetail = useCallback((result: any) => {
    setActiveDetailResult(result);
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
        <>
          <Auth
            onLogin={handleLogin}
            supabaseUrl={storageConfig?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL}
            supabaseKey={storageConfig?.supabaseKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY}
          />
          <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />
        </>
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
      {/*
        Potree Viewer - Exclusive Mode
        When active, EngineeringLayout and CesiumViewer are unmounted to free WebGL resources.
      */}
      {/* Potree Overlay */}
      {activePotreeLayer ? (
        <PotreeViewer
          layers={assets.filter(a =>
            a.type === LayerType.POTREE ||
            a.type === LayerType.LAS
          )}
          initialLayerId={activePotreeLayer.id}
          onClose={() => setActivePotreeLayer(null)}
        />
      ) : (
        <EngineeringLayout
          projects={projects}
          assets={allLayers}
          selectedProjectId={selectedProjectId}
          storageConfig={storageConfig || null}

          // Project Actions
          onSelectProject={setSelectedProjectId}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onShareProject={project => setSharingProject(project)}

          // Layer Actions
          onLayerClick={(id) => {
            setFlyToLayerId(id);
            const asset = assets.find(a => a.id === id);
            if (asset?.data?.isParcel) {
              setActiveParcelAsset(asset);
            } else {
              setActiveParcelAsset(null);
            }
          }}
          onToggleLayer={handleToggleLayer}
          onDeleteLayer={handleDeleteLayer}
          onShareLayer={layer => setSharingAsset(layer)}
          onToggleAllLayers={handleToggleAllLayersInProject}
          onOpenModelViewer={handleOpenViewer}
          onUpdateAsset={handleUpdateAsset}

          // View State
          sceneMode={sceneMode}
          setSceneMode={setSceneMode}
          isViewerMode={isViewerMode}

          // Popup & Tool State
          activePopup={activePopup}
          setActivePopup={setActivePopup}
          measurementMode={measurementMode}
          setMeasurementMode={setMeasurementMode}

          // Upload Props
          onUpload={handleFileUpload}
          onFolderUpload={handleFolderUpload}
          onUrlAdd={(url, type) => handleUrlAdd(url, type, url.split('/').pop() || 'New Layer')}
          onCancelUpload={cancelUpload}
          isUploading={isUploading}
          uploadProgress={typeof uploadProgress === 'number' ? `${uploadProgress}%` : uploadProgress}
          uploadProgressPercent={uploadProgressPercent}

          // Map Settings
          mapType={mapType}
          setMapType={setMapType}
          qualitySettings={qualitySettings}
          setQualitySettings={setQualitySettings}
          isTracking={geolocation.isTracking}
          onStartTracking={geolocation.startTracking}
          onStopTracking={geolocation.stopTracking}
          onFlyToComplete={() => setFlyToLayerId(null)}
          hasPosition={!!geolocation.position}
          mouseCoordinates={mouseCoords}
          cameraHeight={cameraHeight}
          onFlyToLocation={() => setFlyToUserLocation(Date.now())}
          viewer={cesiumViewerInstance}
          positioningLayerId={positioningLayerId}
          setPositioningLayerId={setPositioningLayerId}
          isPlacingOnMap={isPlacingOnMap}
          setIsPlacingOnMap={setIsPlacingOnMap}
          parcelQuery={parcelQuery}
          activeParcelAsset={activeParcelAsset}
          onCloseParcelInfo={() => setActiveParcelAsset(null)}
          onShowParcelDetail={handleShowParcelDetail}
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
            onMapClick={(coords) => {
              if (isPlacingOnMap) {
                const asset = assets.find(a => a.id === isPlacingOnMap);
                if (asset) {
                  handleUpdateAsset(asset.id, asset.name, { position: coords });
                  setIsPlacingOnMap(null); // Clear placement mode after click
                  notify('Model konumu güncellendi', 'success');
                }
              } else if (parcelQuery.isQueryMode) {
                parcelQuery.executeQuery({ mode: 'by_click', lat: coords.lat, lon: coords.lng });
                if (activePopup !== 'parcel') setActivePopup('parcel');
              }
              // Clear active parcel info on map click
              setActiveParcelAsset(null);
            }}
          />
        </EngineeringLayout>
      )}


      {/* Save Modal for Naming */}
      <SaveModal
        isOpen={!!pendingMeasurement}
        onClose={() => {
          if (!isSavingMeasurement) {
            setPendingMeasurement(null);
            setMeasurementMode(MeasurementMode.NONE);
          }
        }}
        onSave={handleConfirmSave}
        defaultName={measurementMode.charAt(0) + measurementMode.slice(1).toLowerCase().replace('_', ' ')}
        measurementText={pendingMeasurement?.text || ''}
        description={!selectedProjectId ? "Bir proje seçili değil. Bu ölçüm tarayıcı belleğinde geçici olarak tutulacak." : undefined}
        isLoading={isSavingMeasurement}
      />

      {/* Share Modals */}
      {sharingAsset && (
        <ShareModal
          asset={sharingAsset}
          onClose={() => setSharingAsset(null)}
          onShare={executeShare}
        />
      )}
      {sharingProject && (() => {
        // Find measurement sub-folders for this project
        const measurementFolderIds = projects
          .filter(p => p.parent_project_id === sharingProject.id && p.is_measurements_folder)
          .map(p => p.id);
        // Get project assets (non-annotations)
        const projectAssets = assets.filter(a =>
          a.project_id === sharingProject.id && a.type !== LayerType.ANNOTATION
        );
        // Get measurements from sub-folders
        const projectMeasurements = assets.filter(a =>
          measurementFolderIds.includes(a.project_id) && a.type === LayerType.ANNOTATION
        );
        return (
          <ShareProjectModal
            project={sharingProject}
            onClose={() => setSharingProject(null)}
            onShare={executeProjectShare}
            assets={projectAssets}
            measurements={projectMeasurements}
          />
        );
      })()}

      {/* Model Viewer Overlay */}
      {_activeModelLayer && (
        <UncoordinatedModelViewer
          layers={[_activeModelLayer]}
          onClose={() => _setActiveModelLayer(null)}
        />
      )}

      {/* Notification Toast */}
      <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />

      {/* Global Parcel Detail Modal */}
      {activeDetailResult && (
        <ParcelDetailModal
          isOpen={!!activeDetailResult}
          onClose={() => setActiveDetailResult(null)}
          data={activeDetailResult}
        />
      )}
    </div>
  );
};

export default App;