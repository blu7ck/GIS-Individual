import React, { ReactNode } from 'react';
import { ProjectPanel } from '../../../components/ProjectPanel';
import { LocationControl } from '../../../components/LocationControl';
import { MapControls } from '../../../components/MapControls';
import { MapTypeSelector } from '../../../components/MapTypeSelector';
import { SceneModeSelector } from '../../../components/SceneModeSelector';
import { UncoordinatedModelViewer } from '../../../components/UncoordinatedModelViewer';
import { Project, AssetLayer, MapType, SceneViewMode } from '../../../types';

interface AppLayoutProps {
    children: ReactNode;
    isViewerMode: boolean;
    selectedProjectId: string | null;
    setSelectedProjectId: (id: string | null) => void;
    projects: Project[];
    assets: AssetLayer[];
    onFlyToLayer: (id: string) => void;
    onToggleLayer: (id: string) => void;
    onDeleteLayer: (id: string) => void;
    onToggleAllLayers: (projectId: string, visible: boolean) => void;
    onShareLayer: (asset: AssetLayer) => void;
    onCreateProject: (name: string) => void;
    onDeleteProject: (id: string) => void;
    onShareProject: (project: Project) => void;
    onLayerClick: (id: string) => void;
    // Map Controls
    mapType: MapType;
    setMapType: (type: MapType) => void;
    sceneMode: SceneViewMode;
    setSceneMode: (mode: SceneViewMode) => void;
    showUserLocation: boolean;
    flyToUserLocation: boolean;
    setFlyToUserLocation: (fly: boolean) => void;
    // Model Viewer
    activeModelLayer: AssetLayer | null;
    onCloseModelViewer: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
    children,
    isViewerMode,
    selectedProjectId,
    setSelectedProjectId,
    projects,
    assets,
    onToggleLayer,
    onDeleteLayer,
    onToggleAllLayers,
    onShareLayer,
    onCreateProject,
    onDeleteProject,
    onShareProject,
    onLayerClick,
    mapType,
    setMapType,
    sceneMode,
    setSceneMode,
    showUserLocation,
    flyToUserLocation,
    setFlyToUserLocation,
    activeModelLayer,
    onCloseModelViewer
}) => {
    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-900 text-slate-100">
            {/* Sidebar - Project Panel */}
            {!isViewerMode && (
                <ProjectPanel
                    projects={projects}
                    assets={assets}
                    selectedProjectId={selectedProjectId}
                    onSelectProject={setSelectedProjectId}
                    onCreateProject={onCreateProject}
                    onDeleteProject={onDeleteProject}
                    onToggleLayer={onToggleLayer}
                    onDeleteLayer={onDeleteLayer}
                    onShareLayer={onShareLayer}
                    onShareProject={onShareProject}
                    onLayerClick={onLayerClick}
                    onToggleAllLayers={onToggleAllLayers}
                    storageConfig={null}
                />
            )}

            {/* Main Content Area */}
            <div className="flex-1 relative h-full">
                {children}

                {/* Map Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                    <MapTypeSelector currentMapType={mapType} onMapTypeChange={setMapType} />
                    <SceneModeSelector currentMode={sceneMode} onModeChange={setSceneMode} />
                </div>

                {/* Navigation Controls */}
                <div className="absolute bottom-8 right-4 z-10 flex flex-col gap-4">
                    <LocationControl
                        isTracking={flyToUserLocation}
                        isLoading={false}
                        hasPosition={showUserLocation}
                        error={null}
                        onStartTracking={() => setFlyToUserLocation(true)}
                        onStopTracking={() => setFlyToUserLocation(false)}
                    />
                    <MapControls
                        mapType={mapType}
                        onMapTypeChange={setMapType}
                        isOpen={false}
                        onToggle={() => { }}
                    />
                </div>
            </div>

            {/* 3D Model Viewer Overlay */}
            {activeModelLayer && (
                <UncoordinatedModelViewer
                    layer={activeModelLayer}
                    onClose={onCloseModelViewer}
                />
            )}
        </div>
    );
};
