import React, { useCallback } from 'react';
import CesiumViewer from '../CesiumViewer';
import { UncoordinatedModelViewer } from './UncoordinatedModelViewer';
import { LocationControl } from './LocationControl';
import { MapControls } from './MapControls';
import { useGeolocation } from '../hooks/useGeolocation';

// Hooks
import { useSecureAuth } from '../src/features/secure-viewer/hooks/useSecureAuth';
import { useSecureViewerState } from '../src/features/secure-viewer/hooks/useSecureViewerState';
import { useLocalMeasurements } from '../src/features/secure-viewer/hooks/useLocalMeasurements';
import { useAutoFlyTo } from '../src/features/secure-viewer/hooks/useAutoFlyTo';

// Components
import { SecureLoginForm } from '../src/features/secure-viewer/components/SecureLoginForm';
import { SecureLayerPanel } from '../src/features/secure-viewer/components/SecureLayerPanel';
import { SecureMeasurementToolbar } from '../src/features/secure-viewer/components/SecureMeasurementToolbar';

interface Props {
  shareId: string;
  workerUrl: string;
}

export const SecureViewer: React.FC<Props> = ({ shareId, workerUrl }) => {
  // 1. Authentication & Data Fetching
  const {
    isAuthenticated,
    isLoading,
    error,
    handleUnlock,
    setIsAuthenticated
  } = useSecureAuth(shareId, workerUrl);

  // 2. Viewer State Management (Layers, UI, Map Settings)
  const {
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
  } = useSecureViewerState();

  // 3. Local Measurements
  const {
    measurements,
    measurementMode,
    setMeasurementMode,
    measurementToolbarOpen,
    setMeasurementToolbarOpen,
    addMeasurement,
    clearMeasurements
  } = useLocalMeasurements();

  // 4. Geolocation
  const geolocation = useGeolocation();

  // 5. Auto Fly-To Logic (side effect)
  useAutoFlyTo(isAuthenticated, layers, setFlyToLayerId, setLayers, setActiveModelLayer);

  // Handle PIN verification with backend
  const handleVerifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const loadedLayers = await handleUnlock(pin);
    if (loadedLayers) {
      setLayers(loadedLayers);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, [handleUnlock, setLayers, setIsAuthenticated]);

  const handleLayerClick = (layer: any) => {
    // Basic implementation - can be expanded
    if (layer.type === 'glb-uncoord') {
      setActiveModelLayer(layer);
    } else {
      setFlyToLayerId(layer.id);
    }
  };

  // Render Login Form if not authenticated
  if (!isAuthenticated) {
    return (
      <SecureLoginForm
        isLoading={isLoading}
        error={error}
        onVerifyPin={handleVerifyPin}
      />
    );
  }

  // Combine layers for viewer
  const allLayers = [...layers, ...measurements];

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900">
      <CesiumViewer
        layers={allLayers}
        measurementMode={measurementMode}
        onMeasurementResult={(result, geometry) => addMeasurement(result, geometry)}
        flyToLayerId={flyToLayerId}
        mapType={mapType}
        sceneMode={sceneMode}
        userLocation={geolocation.position}
        showUserLocation={geolocation.isTracking}
        flyToUserLocation={geolocation.isTracking}
        qualitySettings={qualitySettings}
        onTilesetClick={setActiveTilesetId}
        className="w-full h-full"
      />

      <SecureLayerPanel
        layers={layers}
        onToggleLayer={toggleLayer}
        onLayerClick={handleLayerClick}
        panelOpen={projectPanelOpen}
        setPanelOpen={setProjectPanelOpen}
        activeTilesetId={activeTilesetId}
      />

      <MapControls
        isOpen={activePopup === 'map-settings'}
        onToggle={() => setActivePopup(activePopup === 'map-settings' ? 'none' : 'map-settings')}
        mapType={mapType}
        onMapTypeChange={setMapType}
        qualitySettings={qualitySettings}
      />

      <SecureMeasurementToolbar
        measurementMode={measurementMode}
        setMeasurementMode={setMeasurementMode}
        measurements={measurements}
        onClearMeasurements={clearMeasurements}
        toolbarOpen={measurementToolbarOpen}
        setToolbarOpen={setMeasurementToolbarOpen}
      />

      <LocationControl
        isTracking={geolocation.isTracking}
        isLoading={geolocation.isLoading}
        hasPosition={!!geolocation.position}
        error={geolocation.error}
        onStartTracking={geolocation.startTracking}
        onStopTracking={geolocation.stopTracking}
      />

      {activeModelLayer && (
        <UncoordinatedModelViewer
          layer={activeModelLayer}
          onClose={() => setActiveModelLayer(null)}
        />
      )}
    </div>
  );
};