import React, { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import * as Cesium from 'cesium';
import CesiumViewer from '../../CesiumViewer';
import { EngineeringLayout } from '../../components/layout/EngineeringLayout';
import { useSecureAuth } from '../../features/secure-viewer/hooks/useSecureAuth';
import { SecureLoginForm as LoginForm } from '../../features/secure-viewer/components/SecureLoginForm';
import { SaveModal } from '../../components/ui/SaveModal';
import { CheckCircle, Loader2 } from 'lucide-react';

import type { PopupType } from '../../hooks/useUIState';
import {
  Project,
  AssetLayer,
  LayerType,
  MapType,
  SceneViewMode,
  MeasurementMode,
  AssetStatus,
  QualityLevel,
  PerformanceMode,
  getDefaultQualitySettings,
} from '../../types';
import { useGeolocation } from '../../hooks/useGeolocation';

// Lazy-load heavy viewer components for better initial load performance
const PotreeViewer = React.lazy(() => import('../../features/viewer/components/PotreeViewer').then(m => ({ default: m.PotreeViewer })));
const UncoordinatedModelViewer = React.lazy(() => import('../../components/viewer/UncoordinatedModelViewer').then(m => ({ default: m.UncoordinatedModelViewer })));

const SHARED_PROJECT_ID = 'shared-project';

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
  const [viewMode, setViewMode] = useState<'map' | 'potree' | 'model' | 'done'>('map');
  const [activePotreeLayerId, setActivePotreeLayerId] = useState<string | null>(null);
  const [activeModelLayerId, setActiveModelLayerId] = useState<string | null>(null);

  // Map State
  const [mapType, setMapType] = useState<MapType>(MapType.SATELLITE);
  const [sceneMode, setSceneMode] = useState<SceneViewMode>(SceneViewMode.SCENE3D);
  const [qualitySettings, setQualitySettings] = useState(() => ({
    ...getDefaultQualitySettings(),
    qualityLevel: QualityLevel.LOW,
    performanceMode: PerformanceMode.BALANCED,
    maximumScreenSpaceError: 16,
    tileCacheSize: 200,
    textureCacheSize: 64,
    cacheBytes: 32 * 1024 * 1024,
    skipLevels: 4,
    baseScreenSpaceError: 4096,
  }));
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>(MeasurementMode.NONE);

  // Cesium Viewer Instance (needed for compass, status bar, etc.)
  const [cesiumViewerInstance, setCesiumViewerInstance] = useState<Cesium.Viewer | null>(null);

  // Mouse & Camera State for Status Bar (lat/lon/elev)
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number; height: number } | null>(null);
  const [cameraHeight, setCameraHeight] = useState(10000);

  // UI State
  const [activePopup, setActivePopup] = useState<PopupType>('none');

  // Measurement Caching (session-only, not persisted)
  const [pendingMeasurement, setPendingMeasurement] = useState<{ text: string; geometry: any; mode: string } | null>(null);
  const [cachedMeasurements, setCachedMeasurements] = useState<AssetLayer[]>([]);

  // Camera / Location State
  const [flyToLayerId, setFlyToLayerId] = useState<string | null>(null);
  const geolocation = useGeolocation();
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [flyToUserLocation, setFlyToUserLocation] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number; heading: number | null } | null>(null);

  // --- Geolocation Effects (mirror App.tsx) ---
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

  useEffect(() => {
    if (!geolocation.isTracking) {
      setShowUserLocation(false);
      setUserLocation(null);
    }
  }, [geolocation.isTracking]);

  // --- Derived State ---
  const sharedProject: Project = useMemo(() => ({
    id: SHARED_PROJECT_ID,
    name: 'Paylaşılan Dosyalar',
    description: 'Size paylaşılan güvenli içerik',
    created_at: new Date().toISOString(),
    owner_id: 'shared',
  }), []);

  const projects = useMemo(() => [sharedProject], [sharedProject]);

  // Combine real layers with cached measurements as the "all layers" list
  const allLayers = useMemo(() => [...layers, ...cachedMeasurements], [layers, cachedMeasurements]);

  // Filter layers for specific viewers
  const pointCloudLayers = useMemo(() =>
    layers.filter(l => l.type === LayerType.POTREE || l.type === LayerType.LAS),
    [layers]);

  const modelLayers = useMemo(() =>
    layers.filter(l => l.type === LayerType.GLB_UNCOORD),
    [layers]);

  // Detect whether this is a standalone viewer (no map data)
  const isStandaloneViewer = useMemo(() => {
    const mapAssets = layers.filter(l =>
      l.type === LayerType.TILES_3D ||
      l.type === LayerType.GEOJSON ||
      l.type === LayerType.KML ||
      l.type === LayerType.DXF ||
      l.type === LayerType.SHP ||
      (l.type === LayerType.GLB_UNCOORD && l.position)
    );
    return mapAssets.length === 0;
  }, [layers]);

  // --- Memoized Handlers (mirror App.tsx patterns) ---

  const handleMouseMove = useMemo(() => {
    let lastCall = 0;
    return (coords: { lat: number; lng: number; height: number }) => {
      const now = Date.now();
      if (now - lastCall > 100) {
        setMouseCoords(coords);
        lastCall = now;
      }
    };
  }, []);

  const handleCameraChange = useMemo(() => {
    return (h: number, _head: number, _p: number, _z: number) => {
      setCameraHeight(prev => Math.abs(prev - h) > 1 ? h : prev);
    };
  }, []);

  const handleMeasurementResult = useCallback((text: string, geometry: any, mode: MeasurementMode) => {
    setPendingMeasurement({ text, geometry, mode });
  }, []);

  const handleConfirmSave = useCallback(async (customName: string) => {
    if (!pendingMeasurement) return;

    const tempId = `temp-${Date.now()}`;
    const newCached: AssetLayer = {
      id: tempId,
      project_id: SHARED_PROJECT_ID,
      name: customName,
      type: LayerType.ANNOTATION,
      storage_path: '',
      url: '',
      visible: true,
      opacity: 1,
      data: {
        text: pendingMeasurement.text,
        geometry: pendingMeasurement.geometry,
        mode: pendingMeasurement.mode,
      },
      status: AssetStatus.READY,
    };

    setCachedMeasurements(prev => [...prev, newCached]);
    setPendingMeasurement(null);
    setMeasurementMode(MeasurementMode.NONE);
  }, [pendingMeasurement]);

  const handleVerifyPin = async (pin: string): Promise<boolean> => {
    const loadedLayers = await handleUnlock(pin);
    if (loadedLayers) {
      // Override project_id and make all layers visible
      const normalizedLayers = loadedLayers.map(l => ({
        ...l,
        project_id: SHARED_PROJECT_ID,
        visible: true,
      }));
      setLayers(normalizedLayers);
      setIsAuthenticated(true);
      setActiveProjectId(SHARED_PROJECT_ID);

      // --- Smart Auto-Open Logic ---
      const pcs = normalizedLayers.filter(l => l.type === LayerType.POTREE || l.type === LayerType.LAS);
      const mdls = normalizedLayers.filter(l => l.type === LayerType.GLB_UNCOORD && !l.position);
      const mapAssets = normalizedLayers.filter(l =>
        l.type === LayerType.TILES_3D ||
        l.type === LayerType.GEOJSON ||
        l.type === LayerType.KML ||
        l.type === LayerType.DXF ||
        l.type === LayerType.SHP ||
        (l.type === LayerType.GLB_UNCOORD && l.position)
      );

      if (pcs.length > 0 && mdls.length === 0 && mapAssets.length === 0) {
        setViewMode('potree');
        if (pcs[0]) setActivePotreeLayerId(pcs[0].id);
      } else if (mdls.length > 0 && pcs.length === 0 && mapAssets.length === 0) {
        setViewMode('model');
        if (mdls[0]) setActiveModelLayerId(mdls[0].id);
      } else {
        setViewMode('map');
        // Delayed fly-to to allow CesiumViewer to initialize and load assets
        if (mapAssets.length > 0 && mapAssets[0]) {
          setTimeout(() => setFlyToLayerId(mapAssets[0]!.id), 2500);
        }
      }

      return true;
    }
    return false;
  };

  const handleLayerToggle = useCallback((id: string) => {
    setLayers(prev => prev.map(l =>
      l.id === id ? { ...l, visible: !l.visible } : l
    ));
    // Also check cached measurements
    setCachedMeasurements(prev => prev.map(l =>
      l.id === id ? { ...l, visible: !l.visible } : l
    ));
  }, []);

  const handleLayerClick = useCallback((id: string) => {
    const layer = allLayers.find(l => l.id === id);
    if (!layer) return;

    if (layer.type === LayerType.POTREE || layer.type === LayerType.LAS) {
      setViewMode('potree');
      setActivePotreeLayerId(layer.id);
    } else if (layer.type === LayerType.GLB_UNCOORD && !layer.position) {
      setViewMode('model');
      setActiveModelLayerId(layer.id);
    } else {
      // All map-rendered layers: KML, GeoJSON, DXF, SHP, 3DTiles, coordinated GLB
      setFlyToLayerId(id);
    }
  }, [allLayers]);

  // Open a layer in its dedicated viewer (PotreeViewer or ModelViewer)
  const handleViewInViewer = useCallback((layer: AssetLayer) => {
    if (layer.type === LayerType.POTREE || layer.type === LayerType.LAS) {
      setViewMode('potree');
      setActivePotreeLayerId(layer.id);
    } else if (layer.type === LayerType.GLB_UNCOORD) {
      setViewMode('model');
      setActiveModelLayerId(layer.id);
    }
  }, []);

  // Handle standalone viewer close — show "done" screen instead of empty map
  const handleViewerClose = useCallback(() => {
    if (isStandaloneViewer) {
      setViewMode('done');
    } else {
      setViewMode('map');
    }
  }, [isStandaloneViewer]);

  const handleToggleAllLayers = useCallback((_projectId: string, visible: boolean) => {
    setLayers(prev => prev.map(l => ({ ...l, visible })));
    setCachedMeasurements(prev => prev.map(l => ({ ...l, visible })));
  }, []);

  const handleDeleteLayer = useCallback((id: string) => {
    // Only allow deleting cached measurements in secure mode
    setCachedMeasurements(prev => prev.filter(l => l.id !== id));
  }, []);

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

  // --- "Görüntüleme Tamamlandı" Screen for Standalone viewers ---
  if (viewMode === 'done') {
    return (
      <div className="relative w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Görüntüleme Tamamlandı</h2>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            Paylaşılan içerik başarıyla görüntülendi. Bu sekmeyi kapatabilirsiniz.
          </p>
          <button
            onClick={() => window.close()}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Sekmeyi Kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <EngineeringLayout
        // Data
        projects={projects}
        assets={allLayers}
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
        onDeleteLayer={handleDeleteLayer}
        onShareLayer={() => { }}
        onToggleAllLayers={handleToggleAllLayers}

        // Asset Actions
        onOpenModelViewer={handleViewInViewer}

        // Upload (Disabled in secure mode)
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
        onFlyToLocation={() => setFlyToUserLocation(Date.now())}
        onFlyToComplete={() => setFlyToLayerId(null)}

        // Status Bar Data
        mouseCoordinates={mouseCoords}
        cameraHeight={cameraHeight}
        viewer={cesiumViewerInstance}

        // Positioning (disabled in secure mode)
        positioningLayerId={null}
        setPositioningLayerId={() => { }}
        isPlacingOnMap={null}
        setIsPlacingOnMap={() => { }}
      >
        <CesiumViewer
          className="w-full h-full"
          full
          layers={allLayers}
          sceneMode={sceneMode}
          mapType={mapType}
          flyToLayerId={flyToLayerId}
          measurementMode={measurementMode}
          onMeasurementResult={(text, geometry, mode) => {
            if (mode) handleMeasurementResult(text, geometry, mode);
          }}
          onExitMeasurement={() => setMeasurementMode(MeasurementMode.NONE)}
          qualitySettings={qualitySettings}

          // User Location
          userLocation={userLocation}
          showUserLocation={showUserLocation}
          flyToUserLocation={flyToUserLocation}
          onUserLocationFlyComplete={() => setFlyToUserLocation(0)}

          // Status Bar Handlers
          onMouseMove={handleMouseMove}
          onCameraChange={handleCameraChange}
          onViewerReady={setCesiumViewerInstance}
        />
      </EngineeringLayout>

      {/* Measurement Save Modal — session-only caching */}
      <SaveModal
        isOpen={!!pendingMeasurement}
        onClose={() => {
          setPendingMeasurement(null);
          setMeasurementMode(MeasurementMode.NONE);
        }}
        onSave={handleConfirmSave}
        defaultName={pendingMeasurement?.mode
          ? pendingMeasurement.mode.charAt(0) + pendingMeasurement.mode.slice(1).toLowerCase().replace('_', ' ')
          : 'Ölçüm'}
        measurementText={pendingMeasurement?.text || ''}
        description="Bu ölçüm oturum süresince tarayıcı belleğinde tutulacaktır."
      />

      {/* Overlays for different View Modes — Lazy loaded with Suspense */}
      {viewMode === 'potree' && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        }>
          <PotreeViewer
            layers={pointCloudLayers}
            initialLayerId={activePotreeLayerId || undefined}
            onClose={handleViewerClose}
          />
        </Suspense>
      )}

      {viewMode === 'model' && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        }>
          <UncoordinatedModelViewer
            layers={modelLayers}
            initialLayerId={activeModelLayerId || undefined}
            onClose={handleViewerClose}
          />
        </Suspense>
      )}
    </div>
  );
};