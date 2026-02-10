import React from 'react';
import { ChevronLeft, ChevronRight, LayoutTemplate, Box, Globe, Eye, EyeOff, MapPin, ChevronDown, ChevronUp, Trash2, Edit2, Download, ExternalLink, MousePointer2 } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { AssetLayer, LayerType } from '../../../types';

interface Props {
    layers: AssetLayer[];
    onToggleLayer: (id: string) => void;
    onLayerClick: (layer: AssetLayer, e?: React.MouseEvent) => void;
    panelOpen: boolean;
    setPanelOpen: (open: boolean) => void;
    activeTilesetId?: string | null;
    positioningLayerId: string | null;
    setPositioningLayerId: (id: string | null) => void;
    onUpdatePosition: (id: string, lat: number, lng: number, height: number) => void;
    onRenameLayer?: (id: string, name: string) => void;
    onDeleteLayer?: (id: string) => void;
    onViewInViewer?: (layer: AssetLayer) => void;
}

export const SecureLayerPanel: React.FC<Props> = ({
    layers,
    onToggleLayer,
    onLayerClick,
    panelOpen,
    setPanelOpen,
    activeTilesetId,
    positioningLayerId,
    setPositioningLayerId,
    onUpdatePosition,
    onRenameLayer,
    onDeleteLayer,
    onViewInViewer
}) => {
    // Group layers by type/category
    const mapLayers = layers.filter(l => l.type !== LayerType.ANNOTATION && l.type !== LayerType.GLB_UNCOORD);
    const modelLayers = layers.filter(l => l.type === LayerType.GLB_UNCOORD);
    const annotationLayers = layers.filter(l => l.type === LayerType.ANNOTATION);

    const getIcon = (type: LayerType) => {
        switch (type) {
            case LayerType.TILES_3D: return <Box size={14} className="text-blue-400" />;
            case LayerType.KML: return <Globe size={14} className="text-emerald-400" />;
            case LayerType.GEOJSON: return <Globe size={14} className="text-amber-400" />;
            case LayerType.GLB_UNCOORD: return <Box size={14} className="text-purple-400" />;
            default: return <LayoutTemplate size={14} className="text-slate-400" />;
        }
    };

    return (
        <>
            {/* Panel Toggle Button (Desktop) */}
            <button
                onClick={() => setPanelOpen(!panelOpen)}
                className={`absolute top-24 left-0 z-20 bg-slate-800 text-slate-200 p-1.5 rounded-r-lg shadow-lg border-y border-r border-slate-700 transition-transform duration-300 hidden md:flex ${panelOpen ? 'translate-x-64' : 'translate-x-0'}`}
                aria-label={panelOpen ? "Close panel" : "Open panel"}
            >
                {panelOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>

            {/* Layer Panel */}
            <div className={`absolute top-20 left-4 bottom-8 w-64 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl z-20 flex flex-col transition-transform duration-300 ${panelOpen ? 'translate-x-0' : '-translate-x-[120%]'}`}>
                <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
                    <h2 className="font-semibold text-white flex items-center">
                        <LayoutTemplate className="mr-2 text-blue-400" size={18} />
                        Project Layers
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">

                    {/* Map Layers Section */}
                    {mapLayers.length > 0 && (
                        <div>
                            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                Maps & Tilesets
                            </div>
                            <div className="space-y-1">
                                {mapLayers.map(layer => (
                                    <div key={layer.id} className={`group flex items-center p-2 rounded-lg transition-colors hover:bg-slate-800/50 ${!layer.visible ? 'opacity-60' : ''} ${activeTilesetId === layer.id ? 'bg-blue-900/20 border border-blue-500/30' : 'border border-transparent'}`}>
                                        <button
                                            onClick={() => onToggleLayer(layer.id)}
                                            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors mr-2"
                                        >
                                            {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <div
                                            className="flex-1 min-w-0 cursor-pointer"
                                            onClick={(e) => onLayerClick(layer, e)}
                                        >
                                            <div className="flex items-center text-sm font-medium text-slate-200 truncate">
                                                <span className="mr-2 shrink-0">{getIcon(layer.type)}</span>
                                                <span className="truncate">{layer.name}</span>
                                            </div>
                                        </div>
                                        <button
                                            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                            title="Focus / Settings"
                                            onClick={(e) => onLayerClick(layer, e)}
                                        >
                                            <MousePointer2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3D Models Section */}
                    {modelLayers.length > 0 && (
                        <div>
                            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 mt-2">
                                3D Models
                            </div>
                            <div className="space-y-1">
                                {modelLayers.map(layer => {
                                    const isPositioning = positioningLayerId === layer.id;

                                    return (
                                        <div key={layer.id} className="flex flex-col">
                                            <div className={`group flex items-center p-2 rounded-lg transition-colors hover:bg-slate-800/50 ${isPositioning ? 'bg-purple-900/20 border border-purple-500/30' : ''}`}>
                                                <div
                                                    className="flex-1 min-w-0 cursor-pointer flex items-center"
                                                    onClick={(e) => onLayerClick(layer, e)}
                                                >
                                                    <Box size={14} className="mr-2 text-purple-400 shrink-0" />
                                                    <span className="text-sm font-medium text-slate-200 truncate">{layer.name}</span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        className={`p-1.5 rounded-md transition-all ${isPositioning ? 'bg-purple-500 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-700'}`}
                                                        title="Positioning Settings"
                                                        onClick={() => setPositioningLayerId(isPositioning ? null : layer.id)}
                                                    >
                                                        <MapPin size={14} />
                                                    </button>
                                                    <button
                                                        className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-700"
                                                        title="Rename Layer"
                                                        onClick={() => {
                                                            const newName = prompt('Enter new name:', layer.name);
                                                            if (newName && onRenameLayer) onRenameLayer(layer.id, newName);
                                                        }}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <a
                                                        href={layer.url || layer.blobUrl}
                                                        download={layer.name}
                                                        className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-700"
                                                        title="Download Model"
                                                    >
                                                        <Download size={14} />
                                                    </a>
                                                    <button
                                                        className="p-1.5 rounded-md text-red-500/70 hover:text-red-400 hover:bg-red-500/10"
                                                        title="Delete Layer"
                                                        onClick={() => {
                                                            if (confirm(`Are you sure you want to delete "${layer.name}"?`)) {
                                                                if (onDeleteLayer) onDeleteLayer(layer.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <button
                                                        className="ml-2 p-1.5 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white transition-colors text-xs font-medium px-2 flex items-center gap-1"
                                                        onClick={() => onViewInViewer && onViewInViewer(layer)}
                                                    >
                                                        <ExternalLink size={12} />
                                                        View
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Placement Settings Panel */}
                                            {isPositioning && (
                                                <div className="mt-1 ml-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-tight">Positioning Settings</p>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] text-slate-500 uppercase">Latitude</label>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                                                                value={layer.position?.lat || ''}
                                                                onChange={(e) => onUpdatePosition(layer.id, parseFloat(e.target.value), layer.position?.lng || 0, layer.position?.height || 0)}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[9px] text-slate-500 uppercase">Longitude</label>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                                                                value={layer.position?.lng || ''}
                                                                onChange={(e) => onUpdatePosition(layer.id, layer.position?.lat || 0, parseFloat(e.target.value), layer.position?.height || 0)}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[9px] text-slate-500 uppercase">Height (Altitude)</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white"
                                                            value={layer.position?.height || 0}
                                                            onChange={(e) => onUpdatePosition(layer.id, layer.position?.lat || 0, layer.position?.lng || 0, parseFloat(e.target.value))}
                                                        />
                                                    </div>

                                                    <Button
                                                        size="sm"
                                                        className="w-full justify-center bg-purple-600 hover:bg-purple-500 text-white border-none py-1.5"
                                                        onClick={() => {
                                                            // Logic for map placement mode is already in SecureViewer
                                                            // We just keep this panel open while map is active
                                                        }}
                                                    >
                                                        <MousePointer2 size={12} className="mr-1.5" />
                                                        Click on Map to Place
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Annotations Section */}
                    {annotationLayers.length > 0 && (
                        <div>
                            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 mt-2">
                                Annotations
                            </div>
                            <div className="space-y-1">
                                {annotationLayers.map(layer => (
                                    <div key={layer.id} className="group flex items-center p-2 rounded-lg transition-colors hover:bg-slate-800/50">
                                        <button
                                            onClick={() => onToggleLayer(layer.id)}
                                            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors mr-2"
                                        >
                                            {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center text-sm font-medium text-slate-200 truncate">
                                                <MousePointer2 size={14} className="mr-2 text-pink-400 shrink-0" />
                                                <span className="truncate">{layer.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {layers.length === 0 && (
                        <div className="p-8 text-center">
                            <Box className="mx-auto text-slate-600 mb-2" size={32} />
                            <p className="text-sm text-slate-500">No layers available</p>
                        </div>
                    )}
                </div>

                {/* Footer / Credits */}
                <div className="p-3 border-t border-slate-700/50 text-[10px] text-slate-500 text-center">
                    Powered by FixureLabs Secure Viewer
                </div>


                {/* Mobile Drag Handle (Visual only, as implementation is complex) */}
                <div className="md:hidden absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-700 rounded-full mt-2 opacity-50" />
            </div>

            {/* Mobile Toggle Button */}
            <button
                onClick={() => setPanelOpen(!panelOpen)}
                className="md:hidden absolute bottom-24 left-4 z-20 bg-blue-600 text-white p-3 rounded-full shadow-lg shadow-blue-900/40"
            >
                {panelOpen ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
            </button>
        </>
    );
};
