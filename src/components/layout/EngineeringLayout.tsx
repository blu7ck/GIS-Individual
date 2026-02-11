import React, { useState } from 'react';
import * as Cesium from 'cesium';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Layout Components
import { BottomStatusBar } from './StatusBar/BottomStatusBar';

// UI Components
import { ProjectPanel } from '../ui/ProjectPanel';
import { LocationControl } from '../viewer/LocationControl';
import { MapControls } from '../viewer/MapControls';
import { MeasurementTool } from '../viewer/MeasurementTool';
import { UploadTool } from '../ui/UploadTool';
import { Compass } from '../../features/viewer/components/Compass';

// Types
import type { PopupType } from '../../hooks/useUIState';
import type {
    Project,
    AssetLayer,
    MeasurementMode,
    MapType,
    LayerType,
    QualitySettings,
    StorageConfig
} from '../../types';
import { SceneViewMode } from '../../types';

// ============================================================================
// TYPES
// ============================================================================

interface EngineeringLayoutProps {
    children: React.ReactNode;
    projects: Project[];
    assets: AssetLayer[];
    selectedProjectId: string | null;
    storageConfig?: StorageConfig | null;

    // Project Actions
    onSelectProject: (id: string | null) => void;
    onCreateProject: (name: string) => void;
    onDeleteProject: (id: string) => void;
    onShareProject?: (project: Project) => void;

    // Layer Actions
    onLayerClick?: (id: string) => void;
    onToggleLayer: (id: string) => void;
    onDeleteLayer: (id: string) => void;
    onShareLayer: (layer: AssetLayer) => void;
    onToggleAllLayers?: (projectId: string, visible: boolean) => void;
    onOpenModelViewer?: (asset: AssetLayer) => void;
    onUpdateAsset?: (id: string, newName: string, updates?: { heightOffset?: number; scale?: number; offsetX?: number; offsetY?: number; rotation?: number; position?: { lat: number; lng: number; height: number } }) => void;

    // View State
    sceneMode: SceneViewMode;
    setSceneMode: (mode: SceneViewMode) => void;
    isViewerMode?: boolean;

    // Popup & Tool State
    activePopup: PopupType;
    setActivePopup: (type: PopupType) => void;
    measurementMode: MeasurementMode;
    setMeasurementMode: (mode: MeasurementMode) => void;

    // Upload Props
    onUpload: (file: File, type: LayerType, options?: Record<string, unknown>) => void;
    onFolderUpload: (files: FileList, type: LayerType) => void;
    onUrlAdd: (url: string, type: LayerType) => void;
    onCancelUpload?: () => void;
    isUploading: boolean;
    uploadProgress?: string;
    uploadProgressPercent: number;

    // Map Settings
    mapType: MapType;
    setMapType: (type: MapType) => void;
    qualitySettings?: QualitySettings;
    setQualitySettings?: (settings: QualitySettings) => void;

    // Location
    isTracking: boolean;
    onStartTracking: () => void;
    onStopTracking: () => void;
    hasPosition: boolean;
    onFlyToLocation?: () => void;
    onFlyToComplete?: () => void;


    // Status Data
    mouseCoordinates: { lat: number; lng: number; height: number } | null;
    cameraHeight: number;
    viewer?: Cesium.Viewer | null;
    positioningLayerId?: string | null;
    setPositioningLayerId?: (id: string | null) => void;
    isPlacingOnMap?: string | null;
    setIsPlacingOnMap?: (id: string | null) => void;
    isSecureMode?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const EngineeringLayout: React.FC<EngineeringLayoutProps> = ({
    children,
    // viewer is available for future use (e.g., camera controls)
    viewer: _viewer,
    projects,
    assets,
    selectedProjectId,
    storageConfig,
    onSelectProject,
    onCreateProject,
    onDeleteProject,
    onShareProject,
    onLayerClick,
    onToggleLayer,
    onDeleteLayer,
    onShareLayer,
    onToggleAllLayers,
    onOpenModelViewer,
    onUpdateAsset,
    sceneMode,
    isViewerMode = false,
    activePopup,
    setActivePopup,
    measurementMode,
    setMeasurementMode,
    onUpload,
    onFolderUpload,
    onUrlAdd,
    onCancelUpload,
    isUploading,
    uploadProgress,
    uploadProgressPercent,
    mapType,
    setMapType,
    qualitySettings,
    setQualitySettings,
    isTracking,
    onStartTracking,
    onStopTracking,
    hasPosition,
    onFlyToLocation,
    onFlyToComplete,
    positioningLayerId,
    setPositioningLayerId,
    mouseCoordinates,
    cameraHeight,
    viewer,
    isPlacingOnMap,
    setIsPlacingOnMap,
    isSecureMode = false,
}) => {
    // ========================================================================
    // STATE
    // ========================================================================
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // ========================================================================
    // HANDLERS
    // ========================================================================

    const closePopup = () => setActivePopup('none');

    const togglePopup = (type: PopupType) => {
        if (activePopup === type) {
            closePopup();
        } else {
            setActivePopup(type);
        }
    };

    // Suppress unused variable warning for future use
    void _viewer;

    // ========================================================================
    // RENDER
    // ========================================================================
    return (
        <div className="h-full w-full relative overflow-hidden bg-engineering-bg">

            {/* Map Viewport */}
            <div className="absolute inset-0">
                {React.Children.map(children, child => {
                    if (React.isValidElement(child)) {
                        return React.cloneElement(child as React.ReactElement<any>, { onFlyToComplete });
                    }
                    return child;
                })}
            </div>

            {/* UI Overlay - Only in non-viewer mode */}
            {!isViewerMode && (
                <>
                    {/* Sidebar Container with outside toggle */}
                    <div
                        className={`fixed z-50 transition-all duration-300 ease-in-out ${sidebarOpen
                            ? 'inset-0 md:inset-auto md:top-4 md:bottom-12 md:left-4 md:w-[480px]'
                            : 'top-4 bottom-12 left-0 w-0'
                            }`}
                    >
                        {/* The Card - With Clipping */}
                        <div className={`w-full md:w-[480px] h-full transition-all duration-300 ease-in-out bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/10 md:rounded-2xl shadow-2xl overflow-hidden flex flex-col ${sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'
                            }`}>
                            <ProjectPanel
                                projects={projects}
                                assets={assets}
                                selectedProjectId={selectedProjectId}
                                storageConfig={storageConfig}
                                onSelectProject={onSelectProject}
                                onCreateProject={onCreateProject}
                                onDeleteProject={onDeleteProject}
                                onShareProject={onShareProject}
                                onLayerClick={onLayerClick}
                                onToggleLayer={onToggleLayer}
                                onDeleteLayer={onDeleteLayer}
                                onShareLayer={onShareLayer}
                                onToggleAllLayers={onToggleAllLayers}
                                onOpenModelViewer={onOpenModelViewer}
                                onUpdateAsset={onUpdateAsset}
                                onOpenUpload={() => setActivePopup('upload')}
                                onCancelUpload={onCancelUpload}
                                positioningLayerId={positioningLayerId}
                                setPositioningLayerId={setPositioningLayerId}
                                isPlacingOnMap={isPlacingOnMap}
                                setIsPlacingOnMap={setIsPlacingOnMap}
                                isUploading={isUploading}
                                uploadProgress={uploadProgress}
                                uploadProgressPercent={uploadProgressPercent}
                                readOnly={isSecureMode}
                            />
                        </div>

                        {/* Sidebar Toggle Button - OUTSIDE overflow-hidden */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className={`absolute top-1/2 -translate-y-1/2 w-6 h-20 bg-black/40 backdrop-blur-xl border border-white/5 border-l-0 rounded-r-xl flex items-center justify-center text-white/50 hover:text-white transition-all duration-300 cursor-pointer group shadow-lg z-50 ${sidebarOpen ? 'right-0 md:-right-6 bg-red-500/20 md:bg-black/40' : '-right-6'
                                }`}
                            aria-label={sidebarOpen ? 'Paneli Kapat' : 'Paneli Aç'}
                        >
                            <div className="flex flex-col items-center gap-1">
                                {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                            </div>
                        </button>
                    </div>

                    {/* ============================================ */}
                    {/* 2. Top Right: Location & Compass             */}
                    {/* ============================================ */}
                    <div className="fixed top-4 right-4 z-40 flex items-center gap-3">
                        <LocationControl
                            isTracking={isTracking}
                            onStartTracking={onStartTracking}
                            onStopTracking={onStopTracking}
                            hasPosition={hasPosition}
                            isLoading={false}
                            error={null}
                            onFlyToLocation={onFlyToLocation}
                            performanceMode={qualitySettings?.performanceMode}
                        />
                        <Compass
                            viewer={viewer || null}
                        />
                    </div>

                    {/* ============================================ */}
                    {/* 3. Bottom Right: Measurements & Settings      */}
                    {/* ============================================ */}
                    <div className="fixed bottom-12 right-4 z-40 flex items-center gap-3">
                        {/* Measurement Tool */}
                        <MeasurementTool
                            isOpen={activePopup === 'measurements'}
                            onToggle={() => togglePopup('measurements')}
                            activeMode={measurementMode}
                            onSetMode={setMeasurementMode}
                            performanceMode={qualitySettings?.performanceMode}
                        />

                        {/* Map Settings */}
                        <MapControls
                            mapType={mapType}
                            onMapTypeChange={setMapType}
                            qualitySettings={qualitySettings}
                            onQualityChange={setQualitySettings}
                            isOpen={activePopup === 'settings'}
                            onToggle={() => togglePopup('settings')}
                            performanceMode={qualitySettings?.performanceMode}
                        />
                    </div>

                    {/* Standalone Upload Modal - Only render if NOT in secure mode */}
                    {!isSecureMode && (
                        <UploadTool
                            isOpen={activePopup === 'upload'}
                            onToggle={() => togglePopup('upload')}
                            selectedProjectId={selectedProjectId}
                            onUpload={onUpload}
                            onFolderUpload={onFolderUpload}
                            onUrlAdd={onUrlAdd}
                            isUploading={isUploading}
                            uploadProgress={uploadProgress}
                            uploadProgressPercent={uploadProgressPercent}
                        />
                    )}
                </>
            )}

            {/* ============================================ */}
            {/* Bottom Status Bar - Frosted Glass            */}
            {/* ============================================ */}
            <div className="fixed bottom-0 left-0 right-0 z-50">
                <BottomStatusBar
                    mouseCoordinates={mouseCoordinates}
                    cameraHeight={cameraHeight}
                    projectionMode={sceneMode === SceneViewMode.SCENE2D ? '2D' : 'WGS84'}
                />
            </div>
        </div>
    );
};
