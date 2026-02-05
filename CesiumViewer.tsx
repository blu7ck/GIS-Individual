import React, { useRef, useEffect, useMemo } from 'react';
import * as Cesium from 'cesium';
import { AssetLayer, MeasurementMode, QualitySettings, MapType, SceneViewMode } from './types';
import { Check, X } from 'lucide-react';
import { logger } from './src/utils/logger';

// Hooks
import { useWebGLContextEvents } from './src/features/viewer/core/useWebGLContextEvents';
import { useConsoleOverrides } from './src/features/viewer/core/useConsoleOverrides';
import { useQualitySettings } from './src/features/viewer/core/useQualitySettings';
import { useLayers } from './src/features/viewer/layers/useLayers';
import { useTilesetTransform } from './src/features/viewer/layers/useTilesetTransform';
import { useMeasurement } from './src/features/viewer/measurement/useMeasurement';
import { setupViewerDefaults } from './src/features/viewer/core/setupViewer';

// Components
import { Compass } from './src/features/viewer/components/Compass';
import { UserLocationRenderer } from './src/features/viewer/components/UserLocationRenderer';
import { MeasurementRenderer } from './src/features/viewer/measurement/MeasurementRenderer';
import { AnnotationRenderer } from './src/features/viewer/layers/AnnotationRenderer';

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
  onMeasurementResult: (result: string, geometry?: any) => void;
  flyToLayerId?: string | null;
  mapType?: MapType;
  sceneMode?: SceneViewMode;
  paused?: boolean;
  onTilesetClick?: (layerId: string) => void;
  onHeightOffsetChange?: (layerId: string, heightOffset: number) => void;
  userLocation?: UserLocation | null;
  showUserLocation?: boolean;
  flyToUserLocation?: boolean;
  onUserLocationFlyComplete?: () => void;
  qualitySettings?: QualitySettings;
  className?: string;
  full?: boolean;
  onMouseMove?: (coords: { lat: number; lng: number; height: number }) => void;
  onCameraChange?: (height: number, heading: number, pitch: number, zoomLevel: number) => void;
}

const CesiumViewer: React.FC<Props> = React.memo(({
  layers,
  measurementMode,
  onMeasurementResult,
  flyToLayerId,
  mapType = MapType.TERRAIN_3D,
  sceneMode = SceneViewMode.SCENE3D,
  onTilesetClick,

  userLocation,
  showUserLocation = false,
  flyToUserLocation = false,
  onUserLocationFlyComplete,
  qualitySettings,
  onMouseMove,
  onCameraChange
}) => {
  // 1. Viewer Lifecycle Stability: Use useRef instead of useState
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const isDestroyedRef = useRef(false);

  // Data refs
  const kmlRefs = useRef<Map<string, any>>(new Map());
  const tilesetRefs = useRef<Map<string, any>>(new Map());
  const geoJsonRefs = useRef<Map<string, any>>(new Map());

  // 3. Imagery Provider Stability: useMemo
  const imageryProvider = useMemo(() => {
    if (mapType === MapType.TERRAIN_3D) {
      // For Google 3D Tiles, we don't want a base imagery layer to avoid z-fighting/overlap.
      // We return specific provider or null if we want to handle it manually.
      // But standard Cesium Viewer requires an imageryProvider or it uses default.
      // We can create a dummy or just use OSM and remove it later.
      // Better strategy: Return null here if allowed, or standard OSM and rely on the useEffect to clear it.
      // The previous logic cleared it. Let's return OSM as fallback but handle clear in effect.
      // Actually, creating a provider here is cheap.
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c'],
        maximumLevel: 19
      });
    }

    // Default: OpenStreetMap
    return new Cesium.UrlTemplateImageryProvider({
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
      maximumLevel: 19
    });
  }, [mapType]);

  // Initialize Viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    logger.info('[CesiumViewer] Initializing Native Cesium Viewer');
    isDestroyedRef.current = false;

    // Create viewer with default configuration
    // 3. Imagery: We start with a basic provider to satisfy constructor, then manage immediately.
    const initialImagery = new Cesium.UrlTemplateImageryProvider({
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: ['a', 'b', 'c'],
      maximumLevel: 19
    });

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
      imageryProvider: initialImagery,
      requestRenderMode: false, // 7. Render Stability: Keep false for now as requested
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

    // Set globe base color to black (Visual Fix)
    v.scene.globe.baseColor = Cesium.Color.BLACK;

    viewerRef.current = v;

    // Force strict cleanup
    return () => {
      logger.info('[CesiumViewer] Destroying Viewer');
      isDestroyedRef.current = true;
      if (v && !v.isDestroyed()) {
        v.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  // Imagery & 3D Tiles Handling
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    logger.debug('[CesiumViewer] Updating Imagery/Terrain for mapType:', mapType);

    // Clear existing imagery
    viewer.imageryLayers.removeAll();

    // 3D Terrain Handling (Google Photorealistic 3D Tiles)
    let googleTileset: Cesium.Cesium3DTileset | null = null;
    const scene = viewer.scene;

    if (mapType === MapType.TERRAIN_3D) {
      // Hide globe to prevent z-fighting
      scene.globe.show = false;

      const loadGoogleTiles = async () => {
        try {
          logger.debug('[CesiumViewer] Loading Google 3D Tiles');
          // Add Google 3D Tiles
          // Note: using 'as any' for createGooglePhotorealistic3DTileset if typings are missing in installed version,
          // but usually it's there in recent Cesium.
          googleTileset = await Cesium.createGooglePhotorealistic3DTileset();
          if (!isDestroyedRef.current && scene && !scene.isDestroyed()) {
            scene.primitives.add(googleTileset);
          } else {
            googleTileset?.destroy();
          }
        } catch (error) {
          logger.error('[CesiumViewer] Failed to load Google 3D Tiles:', error);
          if (!isDestroyedRef.current && scene) scene.globe.show = true; // Fallback
        }
      };

      loadGoogleTiles();
    } else {
      // Standard Imagery Mode
      scene.globe.show = true;

      // Add the computed imagery provider
      if (imageryProvider) {
        viewer.imageryLayers.addImageryProvider(imageryProvider);
      }
    }

    return () => {
      // Cleanup Google Tiles if they exist
      if (googleTileset) {
        if (!scene.isDestroyed()) {
          scene.primitives.remove(googleTileset);
        }
        if (!googleTileset.isDestroyed()) {
          googleTileset.destroy();
        }
      }
      // Restore globe visibility
      if (!scene.isDestroyed()) {
        scene.globe.show = true;
      }
    };
  }, [mapType, imageryProvider]); // Viewer ref is stable

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
  }, [sceneMode]);


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

  const [isViewerReady, setIsViewerReady] = React.useState(false);

  useEffect(() => {
    if (viewerRef.current) {
      setIsViewerReady(true);
    } else {
      // Poll or check? No, the init effect runs once.
      // We can set ready state at end of init effect.
    }
  }, []); // Run once, but init effect also runs once. 

  // Actually, let's update the init effect to set isViewerReady
  useEffect(() => {
    if (viewerRef.current) {
      setIsViewerReady(true);
    }
  }); // Check on every render? No.

  // Improving Init Effect to set Ready state
  useEffect(() => {
    if (viewerRef.current && !isViewerReady) {
      setIsViewerReady(true);
    }
  }, [isViewerReady]); // This acts as a listener

  useConsoleOverrides(isViewerReady ? viewerRef.current : null);
  useWebGLContextEvents(isViewerReady ? viewerRef.current : null);
  useQualitySettings(isViewerReady ? viewerRef.current : null, qualitySettings);

  const { renderLayers } = useLayers({
    viewer: isViewerReady ? viewerRef.current : null,
    layers,
    flyToLayerId: flyToLayerId ?? null,
    qualitySettings: qualitySettings || null,
    onTilesetClick,
    tilesetRefs,
    kmlRefs,
    geoJsonRefs
  });

  useTilesetTransform({
    viewer: isViewerReady ? viewerRef.current : null,
    visibleLayers: layers.filter(l => l.visible),
    tilesetRefs
  });

  const { points, measurementText, measurementPosition, clearMeasurement, finishCurrentMeasurement } = useMeasurement({
    viewer: isViewerReady ? viewerRef.current : null,
    mode: measurementMode,
    onMeasurementResult: (res) => onMeasurementResult(res.text, res.geometry)
  });

  return (
    <div className="absolute inset-0">
      <Compass viewer={isViewerReady ? viewerRef.current : null} />

      {/* Measurement FAB Buttons */}
      {measurementMode !== MeasurementMode.NONE && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 flex flex-row gap-3">
          {points.length >= (measurementMode === MeasurementMode.DISTANCE ? 2 : 3) && (
            <button
              onClick={finishCurrentMeasurement}
              className="w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-xl flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95"
              title="Finish Measurement"
            >
              <Check size={24} />
            </button>
          )}
          {points.length >= 1 && (
            <button
              onClick={clearMeasurement}
              className="w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full shadow-xl flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95"
              title="Cancel Measurement"
            >
              <X size={24} />
            </button>
          )}
        </div>
      )}

      {/* Native Container */}
      <div
        ref={containerRef}
        className="w-full h-full"
      />

      {/* Custom Renderers */}
      {isViewerReady && viewerRef.current && !viewerRef.current.isDestroyed() && (
        <>
          {renderLayers()}
          <MeasurementRenderer
            viewer={viewerRef.current}
            points={points}
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
          <AnnotationRenderer layers={layers} />
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