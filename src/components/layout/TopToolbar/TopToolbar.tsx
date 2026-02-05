import React from 'react';
import { Ruler, Map, Box, Crosshair, ChevronDown, Check } from 'lucide-react';
import { MeasurementMode, MapType, SceneViewMode } from '../../../../types';

interface TopToolbarProps {
    measurementMode: MeasurementMode;
    setMeasurementMode: (mode: MeasurementMode) => void;
    mapType: MapType;
    setMapType: (type: MapType) => void;
    sceneMode: SceneViewMode;
    setSceneMode: (mode: SceneViewMode) => void;
    onFitBounds: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
    measurementMode,
    setMeasurementMode,
    mapType,
    setMapType,
    sceneMode,
    setSceneMode,
    onFitBounds
}) => {
    return (
        <div className="h-12 bg-engineering-panel border-b border-engineering-border flex items-center px-4 justify-between shadow-engineering z-10 w-full relative">
            {/* Left Tools */}
            <div className="flex items-center space-x-1">

                {/* Measurement Group */}
                <div className="flex bg-engineering-bg rounded-md p-1 border border-engineering-border">
                    <button
                        onClick={() => setMeasurementMode(measurementMode === MeasurementMode.DISTANCE ? MeasurementMode.NONE : MeasurementMode.DISTANCE)}
                        className={`p-1.5 rounded flex items-center space-x-2 transition-all ${measurementMode === MeasurementMode.DISTANCE ? 'bg-engineering-primary text-white shadow-sm' : 'text-engineering-text-secondary hover:text-engineering-text-primary hover:bg-engineering-panel'}`}
                        title="Measure Distance (M)"
                    >
                        <Ruler size={16} />
                        <span className="text-xs font-medium hidden lg:inline">Distance</span>
                    </button>
                    <div className="w-px bg-engineering-border mx-1 my-1"></div>
                    <button
                        onClick={() => setMeasurementMode(measurementMode === MeasurementMode.AREA ? MeasurementMode.NONE : MeasurementMode.AREA)}
                        className={`p-1.5 rounded flex items-center space-x-2 transition-all ${measurementMode === MeasurementMode.AREA ? 'bg-engineering-primary text-white shadow-sm' : 'text-engineering-text-secondary hover:text-engineering-text-primary hover:bg-engineering-panel'}`}
                        title="Measure Area"
                    >
                        <Box size={16} />
                        <span className="text-xs font-medium hidden lg:inline">Area</span>
                    </button>
                </div>

                <div className="w-px h-6 bg-engineering-border mx-2"></div>

                {/* View Actions */}
                <button
                    onClick={onFitBounds}
                    className="p-2 rounded text-engineering-text-secondary hover:text-engineering-text-primary hover:bg-engineering-bg transition-colors border border-transparent hover:border-engineering-border"
                    title="Fit to Bounds (F)"
                >
                    <Crosshair size={18} />
                </button>
            </div>

            {/* Right Tools - View Modes */}
            <div className="flex items-center space-x-3">
                {/* Map Type Dropdown (Mock) */}
                <div className="relative group">
                    <button className="flex items-center space-x-2 text-xs font-medium bg-engineering-bg px-3 py-1.5 rounded border border-engineering-border text-engineering-text-primary hover:border-engineering-primary transition-colors">
                        <Map size={14} className="text-engineering-text-secondary" />
                        <span>{mapType.replace('_', ' ')}</span>
                        <ChevronDown size={12} className="opacity-50" />
                    </button>
                    {/* Dropdown Content */}
                    <div className="absolute right-0 top-full mt-1 w-40 bg-engineering-panel border border-engineering-border rounded shadow-engineering-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                        {[MapType.OPENSTREETMAP, MapType.TERRAIN_3D].map(type => (
                            <button
                                key={type}
                                onClick={() => setMapType(type)}
                                className="w-full text-left px-3 py-2 text-xs text-engineering-text-secondary hover:text-engineering-text-primary hover:bg-engineering-bg flex items-center justify-between"
                            >
                                <span>{type.replace('_', ' ')}</span>
                                {mapType === type && <Check size={12} className="text-engineering-primary" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2D/3D Toggle */}
                <div className="flex bg-engineering-bg rounded p-0.5 border border-engineering-border">
                    <button
                        onClick={() => setSceneMode(SceneViewMode.SCENE2D)}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${sceneMode === SceneViewMode.SCENE2D ? 'bg-engineering-panel text-engineering-primary shadow-sm' : 'text-engineering-text-muted hover:text-engineering-text-primary'}`}
                    >
                        2D
                    </button>
                    <button
                        onClick={() => setSceneMode(SceneViewMode.SCENE3D)}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${sceneMode === SceneViewMode.SCENE3D ? 'bg-engineering-panel text-engineering-primary shadow-sm' : 'text-engineering-text-muted hover:text-engineering-text-primary'}`}
                    >
                        3D
                    </button>
                </div>
            </div>
        </div>
    );
};
