import React, { useRef, useEffect } from 'react';
import * as Cesium from 'cesium';
import { AssetLayer, MeasurementMode, QualitySettings, MapType, SceneViewMode } from './types';
import { Check, X } from 'lucide-react';
import { logger } from './utils/logger';

// Hooks
import { useWebGLContextEvents } from './features/viewer/core/useWebGLContextEvents';
import { useConsoleOverrides } from './features/viewer/core/useConsoleOverrides';
import { useQualitySettings } from './features/viewer/core/useQualitySettings';
import { useLayers } from './features/viewer/layers/useLayers';
import { useMeasurement } from './features/viewer/measurement/useMeasurement';
import { setupViewerDefaults } from './features/viewer/core/setupViewer';

// Components
import { UserLocationRenderer } from './features/viewer/components/UserLocationRenderer';
import { MeasurementRenderer } from './features/viewer/measurement/MeasurementRenderer';
import { AnnotationRenderer } from './features/viewer/layers/AnnotationRenderer';

// Types
export interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number; // metres
  heading?: number | null; // degrees from north
}

interface Props {
  layers: AssetLayer[];
  measurementMode: MeasurementMode;
  onMeasurementResult: (result: string, geometry?: any, mode?: MeasurementMode) => void;
  onExitMeasurement?: () => void;
  flyToLayerId?: string | null;
  mapType?: MapType;
  sceneMode?: SceneViewMode;
  paused?: boolean;
  onTilesetClick?: (layerId: string) => void;
  onHeightOffsetChange?: (layerId: string, heightOffset: number) => void;
  userLocation?: UserLocation | null;
  showUserLocation?: boolean;
  flyToUserLocation?: number;
  onUserLocationFlyComplete?: () => void;
  onFlyToComplete?: () => void;
  qualitySettings?: QualitySettings;
  className?: string;
  full?: boolean;
  onMouseMove?: (coords: { lat: number; lng: number; height: number }) => void;
  onCameraChange?: (height: number, heading: number, pitch: number, zoomLevel: number) => void;
  onViewerReady?: (viewer: Cesium.Viewer) => void;
}

const CesiumViewer: React.FC<Props> = React.memo(({
  layers,
  measurementMode,
  onMeasurementResult,
  onExitMeasurement,
  flyToLayerId,
  mapType = MapType.STANDARD,
  sceneMode = SceneViewMode.SCENE3D,
  onTilesetClick,

  userLocation,
  showUserLocation = false,
  flyToUserLocation = 0,
  onUserLocationFlyComplete,
  onFlyToComplete,
  qualitySettings,
  onMouseMove,
  onCameraChange,
  onViewerReady
}) => {
  // 1. Viewer Lifecycle Stability: Use useRef instead of useState
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const isDestroyedRef = useRef(false);

  // Data refs
  const kmlRefs = useRef<Map<string, any>>(new Map());
  const tilesetRefs = useRef<Map<string, any>>(new Map());
  const geoJsonRefs = useRef<Map<string, any>>(new Map());

  const [isViewerReady, setIsViewerReady] = React.useState(false);
  const [initError, setInitError] = React.useState<string | null>(null);


  // Initialize Viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    logger.info('[CesiumViewer] Initializing Native Cesium Viewer');
    isDestroyedRef.current = false;

    try {
      // Set Base URL explicitly for the library (Critical for Workers)
      const baseUrl = 'https://cesium.com/downloads/cesiumjs/releases/1.136/Build/Cesium/';
      (Cesium as any).buildModuleUrl?.setBaseUrl(baseUrl);

      // Construct a very stable initial imagery provider (avoid ion)
      const initialImagery = new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c'],
        maximumLevel: 19
      });

      // Create viewer with default configuration
      const v = new Cesium.Viewer(containerRef.current, {
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        homeButton: false,
        selectionIndicator: false,
        infoBox: false,
        vrButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        geocoder: false,
        imageryProvider: initialImagery, // Guaranteed start imagery
        requestRenderMode: true, // Optimized for performance
        maximumRenderTimeChange: 0.1, // Smooth updates when needed
        contextOptions: {
          webgl: {
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
            failIfMajorPerformanceCaveat: false,
            powerPreference: 'high-performance'
          }
        }
      } as Cesium.Viewer.ConstructorOptions);

      // Apply defaults
      setupViewerDefaults(v);

      v.scene.globe.baseColor = Cesium.Color.fromCssColorString('#011627');

      viewerRef.current = v;
      setIsViewerReady(true);
      setInitError(null);

      if (onViewerReady) {
        onViewerReady(v);
      }

    } catch (e: any) {
      logger.error('[CesiumViewer] Initialization Critical Error:', e);
      setInitError(e.message || 'Cesium initialize hatası');
    }

    // Force strict cleanup
    return () => {
      logger.info('[CesiumViewer] Destroying Viewer');
      isDestroyedRef.current = true;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
      setIsViewerReady(false);
    };
  }, []);

  // 1. Imagery Handling
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    logger.debug('[CesiumViewer] Updating Imagery for mapType:', mapType);
    let isCancelled = false;

    const updateImagery = async () => {
      // Don't clear immediately to avoid black screen during loading

      // Add new provider based on map type
      let newProvider: Cesium.ImageryProvider;

      try {
        if (mapType === MapType.SATELLITE) {
          // Use modern fromUrl for ArcGIS
          newProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
          );
        } else {
          // Default to Standard (OSM)
          newProvider = new Cesium.UrlTemplateImageryProvider({
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            subdomains: ['a', 'b', 'c'],
            maximumLevel: 19
          });
        }

        if (!viewer.isDestroyed() && !isCancelled) {
          logger.info('[CesiumViewer] Successfully loaded imagery provider');
          // Clear and add
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.addImageryProvider(newProvider);
        }
      } catch (error) {
        if (isCancelled) return;
        logger.error('[CesiumViewer] Failed to load imagery:', error);
        // Fallback to OSM
        const fallback = new Cesium.UrlTemplateImageryProvider({
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          subdomains: ['a', 'b', 'c'],
          maximumLevel: 19
        });
        if (!viewer.isDestroyed()) {
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.addImageryProvider(fallback);
        }
      }
    };

    updateImagery();

    return () => {
      isCancelled = true;
    };
  }, [mapType, isViewerReady]);

  // 2. Terrain Handling (Always ArcGIS 3D Terrain)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const scene = viewer.scene;
    if (scene.isDestroyed()) return;

    const updateTerrain = async () => {
      // Always load ArcGIS Terrain for 3D elevation
      try {
        logger.info('[CesiumViewer] Loading ArcGIS 3D terrain provider');
        const terrainProvider = await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
          "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"
        );

        if (!scene.isDestroyed()) {
          scene.terrainProvider = terrainProvider;
          scene.globe.depthTestAgainstTerrain = true;
          scene.globe.enableLighting = false; // Keep lighting off for better visibility
          scene.requestRender();
          logger.info('[CesiumViewer] Terrain provider successfully applied');
        }
      } catch (e) {
        logger.warn('[CesiumViewer] Failed to load 3D terrain provider, falling back to ellipsoid:', e);
        if (!scene.isDestroyed()) {
          scene.terrainProvider = new Cesium.EllipsoidTerrainProvider();
        }
      }
    };

    updateTerrain();
  }, [isViewerReady]); // Run when viewer is ready

  // 4. Scene Mode Correctness
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    let targetMode = Cesium.SceneMode.SCENE3D;
    if (sceneMode === SceneViewMode.SCENE2D) targetMode = Cesium.SceneMode.SCENE2D;
    else if (sceneMode === SceneViewMode.COLUMBUS_VIEW) targetMode = Cesium.SceneMode.COLUMBUS_VIEW;

    if (viewer.scene.mode !== targetMode) {
      // Morph with 0 duration to allow instant switch if desired, or let it animate.
      // Standard setter animates.
      // viewer.scene.mode = targetMode; // Read-only in some versions, used morphTo...
      switch (targetMode) {
        case Cesium.SceneMode.SCENE2D:
          viewer.scene.morphTo2D(0);
          break;
        case Cesium.SceneMode.COLUMBUS_VIEW:
          viewer.scene.morphToColumbusView(0);
          break;
        case Cesium.SceneMode.SCENE3D:
        default:
          viewer.scene.morphTo3D(0);
          break;
      }
    }
  }, [sceneMode, isViewerReady]);


  // 5. Event Safety & 6. Camera Safety
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Mouse Move Handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    if (onMouseMove) {
      handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        if (!movement.endPosition) return;

        // 7. Render Stability: Use pickPosition for 3D tiles support
        const cartesian = viewer.scene.pickPosition(movement.endPosition);

        if (cartesian) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          onMouseMove({
            lat: Cesium.Math.toDegrees(cartographic.latitude),
            lng: Cesium.Math.toDegrees(cartographic.longitude),
            height: cartographic.height
          });
        } else {
          // Fallback
          const ray = viewer.camera.getPickRay(movement.endPosition);
          const cartesianFallback = ray ? viewer.scene.globe.pick(ray, viewer.scene) : null;
          if (cartesianFallback) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesianFallback);
            onMouseMove({
              lat: Cesium.Math.toDegrees(cartographic.latitude),
              lng: Cesium.Math.toDegrees(cartographic.longitude),
              height: 0
            });
          }
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    // Camera Handler
    const updateCameraStats = () => {
      if (!onCameraChange) return;
      const camera = viewer.camera;
      const height = camera.positionCartographic.height;
      const heading = Cesium.Math.toDegrees(camera.heading);
      const pitch = Cesium.Math.toDegrees(camera.pitch);

      // 6. Camera Safety: Guard against division by zero or negative log
      const safeHeight = Math.max(1, height);
      // Approx zoom calculation
      const zoomLevel = Math.round(Math.log2(20000000 / safeHeight));
      const safeZoom = isFinite(zoomLevel) ? zoomLevel : 1;

      onCameraChange(height, heading, pitch, safeZoom);
    };

    viewer.camera.percentageChanged = 0.1;
    viewer.camera.changed.addEventListener(updateCameraStats);
    updateCameraStats(); // Init

    return () => {
      if (!handler.isDestroyed()) handler.destroy();
      if (viewer && !viewer.isDestroyed()) {
        viewer.camera.changed.removeEventListener(updateCameraStats);
      }
    };
  }, [onMouseMove, onCameraChange]); // Viewer ref stable

  // 8. Hook Validation - Connecting hooks
  // Note: custom hooks need to be updated to accept viewer instance if they don't already, 
  // or we pass the ref.current if they expect the instance.
  // The existing hooks generally take (viewer, ...) as arguments.

  // Assuming hooks handle "viewer | null" gracefully.

  // IMPORTANT: Since we switched to useRef, 'viewer' variable here is not stateful.
  // We need to trigger re-renders when viewer becomes ready if we want to render children that depend on it.
  // HOWEVER, the "hardened" requirement says "Keep viewer in ref, not state".
  // This means we might handle children rendering differently.
  // But our children (MeasurementRenderer etc) need the viewer instance.
  // If we don't use state, we won't re-render when viewer is created, so children won't get it.
  // SOLUTION: We DO need a state for "isReady" or just use state for viewer but without the setter issues.
  // The prompt says "UI render conditions... requires isViewerReady state".



  // (Redundant hooks removed)

  useConsoleOverrides(isViewerReady ? viewerRef.current : null);
  useWebGLContextEvents(isViewerReady ? viewerRef.current : null);
  useQualitySettings(isViewerReady ? viewerRef.current : null, qualitySettings);

  const { renderLayers } = useLayers({
    viewer: isViewerReady ? viewerRef.current : null,
    layers,
    flyToLayerId: flyToLayerId ?? null,
    onFlyToComplete,
    qualitySettings: qualitySettings || null,
    onTilesetClick,
    tilesetRefs,
    kmlRefs,
    geoJsonRefs
  });

  const { points, tempPoint, measurementText, measurementPosition, clearMeasurement, finishCurrentMeasurement } = useMeasurement({
    viewer: isViewerReady ? viewerRef.current : null,
    mode: measurementMode,
    onMeasurementResult: (res) => onMeasurementResult(res.text, res.geometry, res.mode)
  });

  return (
    <div className="absolute inset-0">
      {/* Measurement FAB Buttons */}
      {/* Measurement UI - Centered Bottom (Raised) */}
      {measurementMode !== MeasurementMode.NONE && (
        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-40 flex items-center justify-center gap-4 pointer-events-auto">

          {/* Finish Button (Visible when valid) - LEFT side */}
          {points.length >= (measurementMode === MeasurementMode.DISTANCE ? 2 : 3) && (
            <button
              onClick={() => {
                finishCurrentMeasurement();
                onExitMeasurement?.(); // Ensure exit immediately
              }}
              className="w-12 h-12 rounded-full bg-teal-500/90 hover:bg-teal-400 backdrop-blur-md text-white shadow-lg shadow-teal-500/20 transition-all duration-300 flex items-center justify-center hover:scale-110 active:scale-95 animate-in zoom-in spin-in-12 duration-300"
              title="Ölçümü Tamamla"
            >
              <Check size={24} strokeWidth={3} />
            </button>
          )}

          {/* Cancel Button (Always visible in mode) - RIGHT side */}
          <button
            onClick={() => {
              clearMeasurement();
              onExitMeasurement?.();
            }}
            className="group w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-red-500/80 transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95"
            title="İptal Et ve Çık"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Error Overlay */}
      {initError && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 text-white p-6 text-center">
          <div className="bg-red-500/20 border border-red-500/50 p-8 rounded-3xl backdrop-blur-xl">
            <X size={48} className="text-red-500 mb-4 mx-auto" />
            <h2 className="text-xl font-bold mb-2 uppercase tracking-widest">Görüntüleme Hatası</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-xs">{initError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition-all"
            >
              SAYFAYI YENİLE
            </button>
          </div>
        </div>
      )}

      {/* Native Container */}
      <div
        ref={containerRef}
        className="w-full h-full relative z-0"
      />

      {/* Custom Renderers */}
      {isViewerReady && viewerRef.current && !viewerRef.current.isDestroyed() && (
        <>
          {renderLayers()}
          <MeasurementRenderer
            viewer={viewerRef.current}
            points={points}
            tempPoint={tempPoint}
            mode={measurementMode}
            measurementText={measurementText}
            measurementPosition={measurementPosition}
          />
          <UserLocationRenderer
            viewer={viewerRef.current}
            userLocation={userLocation || null}
            showUserLocation={showUserLocation}
            flyToUserLocation={flyToUserLocation}
            onUserLocationFlyComplete={onUserLocationFlyComplete}
          />
          <AnnotationRenderer layers={layers} viewer={viewerRef.current} />
        </>
      )}
    </div>
  );
}, (prev, next) => {
  // 7. Render Stability: Simplified Comparison using pure referential equality where reasonable
  // Complex deep comparisons are expensive.
  // We assume immutable updates from parent.

  return (
    prev.measurementMode === next.measurementMode &&
    prev.flyToLayerId === next.flyToLayerId &&
    prev.mapType === next.mapType &&
    prev.sceneMode === next.sceneMode &&
    prev.paused === next.paused &&
    prev.showUserLocation === next.showUserLocation &&
    prev.flyToUserLocation === next.flyToUserLocation &&
    prev.qualitySettings === next.qualitySettings && // Assuming immutable quality settings
    // User location might be new object every time, so deep check needed or just check primitive lat/lng
    prev.userLocation?.lat === next.userLocation?.lat &&
    prev.userLocation?.lng === next.userLocation?.lng &&
    // Layers: check reference first?
    prev.layers === next.layers
    // If strict deep check needed:
    // (prev.layers === next.layers || (prev.layers.length === next.layers.length && prev.layers.every((l,i) => l === next.layers[i])))
  );
});

CesiumViewer.displayName = 'CesiumViewer';
export default CesiumViewer;