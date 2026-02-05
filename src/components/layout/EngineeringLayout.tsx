import React, { useState } from 'react';
import { Sidebar } from './Sidebar/Sidebar';
import { TopToolbar } from './TopToolbar/TopToolbar';
import { BottomStatusBar } from './StatusBar/BottomStatusBar';
import { Project, AssetLayer, MeasurementMode, MapType, SceneViewMode } from '../../../types';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface EngineeringLayoutProps {
    children: React.ReactNode;

    // Data
    projects: Project[];
    assets: AssetLayer[];
    selectedProjectId: string | null;

    // Actions
    onSelectProject: (id: string) => void;
    onCreateProject: () => void;
    onDeleteProject: (id: string) => void;
    onShareProject: (project: Project) => void;

    onLayerClick: (id: string) => void;
    onToggleLayer: (id: string) => void;
    onDeleteLayer: (id: string) => void;
    onShareLayer: (layer: AssetLayer) => void;
    onToggleAllLayers: (visible: boolean) => void; // Added missing prop
    onFlyToLayer: (id: string) => void; // Added missing prop to match usage in App.tsx

    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onFolderUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUrlAdd: (url: string, name: string) => void;

    // View State
    mapType: MapType;
    setMapType: (type: MapType) => void;
    sceneMode: SceneViewMode;
    setSceneMode: (mode: SceneViewMode) => void;

    measurementMode: MeasurementMode; // Added
    setMeasurementMode: (mode: MeasurementMode) => void; // Added

    // Status Data

    // Status Data
    mouseCoordinates: { lat: number; lng: number; height: number } | null;
    cameraHeight: number;

    onFitBounds: () => void;

    // UI State
    activeModelLayer: string | null;
    onCloseModelViewer: () => void;

    isViewerMode?: boolean;
    showUserLocation?: boolean;
    flyToUserLocation?: boolean;
    setFlyToUserLocation?: (v: boolean) => void;
}

export const EngineeringLayout: React.FC<EngineeringLayoutProps> = ({
    children,
    projects,
    assets,
    selectedProjectId,
    onSelectProject,
    onCreateProject,
    onDeleteProject,
    onShareProject,
    onLayerClick,
    onToggleLayer,
    onDeleteLayer,
    onShareLayer,
    onUpload,
    onFolderUpload,
    mapType,
    setMapType,
    sceneMode,
    setSceneMode,
    measurementMode,
    setMeasurementMode,
    mouseCoordinates,
    cameraHeight,
    onFitBounds,
    isViewerMode = false
}) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="flex h-full w-full bg-engineering-bg text-engineering-text-primary overflow-hidden">

            {/* Sidebar */}
            {!isViewerMode && (
                <div className={`flex-shrink-0 transition-all duration-300 ease-in-out border-r border-engineering-border ${sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
                    <Sidebar
                        projects={projects}
                        assets={assets}
                        selectedProjectId={selectedProjectId}
                        onSelectProject={onSelectProject}
                        onCreateProject={onCreateProject}
                        onDeleteProject={onDeleteProject}
                        onShareProject={onShareProject}
                        onLayerClick={onLayerClick}
                        onToggleLayer={onToggleLayer}
                        onDeleteLayer={onDeleteLayer}
                        onShareLayer={onShareLayer}
                        onUpload={onUpload}
                        onFolderUpload={onFolderUpload}
                    />
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">

                {/* Toggle Sidebar Button (Absolute) */}
                {!isViewerMode && (
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="absolute top-16 left-2 z-50 p-2 bg-engineering-panel border border-engineering-border rounded-md shadow-engineering text-engineering-text-secondary hover:text-engineering-text-primary hover:bg-engineering-bg transition-colors"
                        style={{ left: sidebarOpen ? '0.5rem' : '0.5rem' }} // Can adjust if needed
                    >
                        {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                    </button>
                )}

                {/* Top Toolbar */}
                <TopToolbar
                    measurementMode={measurementMode}
                    setMeasurementMode={setMeasurementMode}
                    mapType={mapType}
                    setMapType={setMapType}
                    sceneMode={sceneMode}
                    setSceneMode={setSceneMode}
                    onFitBounds={onFitBounds}
                />

                {/* Map Viewport */}
                <div className="flex-1 relative bg-black">
                    {children}
                </div>

                {/* Bottom Status Bar */}
                <BottomStatusBar
                    mouseCoordinates={mouseCoordinates}
                    cameraHeight={cameraHeight}
                    zoomLevel={0}
                    projectionMode={sceneMode === SceneViewMode.SCENE2D ? '2D' : 'WGS84'}
                />
            </div>
        </div>
    );
};
