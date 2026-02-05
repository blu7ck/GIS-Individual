import React, { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal, RefreshCw, Save } from 'lucide-react';
import { AssetLayer, LayerType } from '../types';
import { ToolbarItem } from './ToolbarItem';

interface Props {
    assets: AssetLayer[];
    onUpdateAsset?: (id: string, newName: string, updates?: { heightOffset?: number; scale?: number }) => void;
    isOpen: boolean;
    onToggle: () => void;
}

export const LayerHeightTool: React.FC<Props> = ({ assets, onUpdateAsset, isOpen, onToggle }) => {

    // Track local height changes (not yet saved)
    const [localHeights, setLocalHeights] = useState<Record<string, number>>({});
    // Track which layers have unsaved changes
    const [dirtyLayers, setDirtyLayers] = useState<Set<string>>(new Set());
    const [isSaving] = useState(false);

    // Debounce ref for transform updates
    const transformTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});


    // Filter for visible 3D Tiles only
    const activeLayers = assets.filter(
        a => a.visible && a.type === LayerType.TILES_3D
    );

    // Initialize local heights from assets
    useEffect(() => {
        const heights: Record<string, number> = {};
        activeLayers.forEach(layer => {
            if (localHeights[layer.id] === undefined) {
                heights[layer.id] = layer.heightOffset || 0;
            }
        });
        if (Object.keys(heights).length > 0) {
            setLocalHeights(prev => ({ ...prev, ...heights }));
        }
    }, [activeLayers]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            Object.keys(transformTimeoutRef.current).forEach(key => {
                cancelAnimationFrame(transformTimeoutRef.current[key] as any);
            });
        };
    }, []);

    const handleHeightChange = (asset: AssetLayer, newHeight: number) => {
        // Update local height state immediately for UI responsiveness
        setLocalHeights(prev => ({ ...prev, [asset.id]: newHeight }));

        // Mark as dirty (unsaved)
        setDirtyLayers(prev => new Set(prev).add(asset.id));

        // Use requestAnimationFrame for smooth, real-time updates without debounce lag
        if (transformTimeoutRef.current[asset.id]) {
            cancelAnimationFrame(transformTimeoutRef.current[asset.id] as any);
        }

        transformTimeoutRef.current[asset.id] = (requestAnimationFrame(() => {
            if ((window as any).__hekamapApplyTransform) {
                (window as any).__hekamapApplyTransform(asset.id, newHeight, asset.scale ?? 1);
            }
        }) as any);
    };

    const handleSave = (asset: AssetLayer) => {
        const newHeight = localHeights[asset.id] ?? asset.heightOffset ?? 0;

        // Save to database via onUpdateAsset
        if (onUpdateAsset) {
            onUpdateAsset(asset.id, asset.name, { heightOffset: newHeight, scale: asset.scale });
        }

        // Remove from dirty set
        setDirtyLayers(prev => {
            const newSet = new Set(prev);
            newSet.delete(asset.id);
            return newSet;
        });
    };

    const handleSaveAll = () => {
        dirtyLayers.forEach(layerId => {
            const asset = activeLayers.find(a => a.id === layerId);
            if (asset) {
                handleSave(asset);
            }
        });
    };

    const handleResetAll = () => {
        dirtyLayers.forEach(layerId => {
            handleReset(layerId);
        });
    };

    const handleReset = (layerId: string) => {
        const asset = activeLayers.find(a => a.id === layerId);
        if (!asset) return;

        const newHeight = 0;
        setLocalHeights(prev => ({ ...prev, [layerId]: newHeight }));
        setDirtyLayers(prev => new Set(prev).add(layerId));

        if ((window as any).__hekamapApplyTransform) {
            (window as any).__hekamapApplyTransform(layerId, newHeight, asset.scale ?? 1);
        }
    };


    return (
        <ToolbarItem
            icon={<SlidersHorizontal size={20} />}
            label="Layer Height"
            isOpen={isOpen}
            onToggle={onToggle}
            isActive={isOpen || dirtyLayers.size > 0}
        >
            {/* Header: Save & Reset All */}
            {dirtyLayers.size > 0 && (
                <div className="flex gap-2 mb-3 bg-[#12B285]/10 p-2 rounded-lg border border-[#12B285]/30">
                    <button
                        onClick={handleSaveAll}
                        disabled={isSaving}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#12B285] hover:bg-[#12B285]/80 text-white text-xs py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                        {isSaving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                        Save All ({dirtyLayers.size})
                    </button>
                    <button
                        onClick={handleResetAll}
                        disabled={isSaving}
                        className="p-1.5 text-[#12B285]/80 hover:text-white hover:bg-[#12B285]/20 rounded transition-colors"
                        title="Reset All Changes"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            )}

            {activeLayers.length === 0 ? (
                <div className="text-xs text-carta-mist-500 italic text-center py-2">
                    No active 3D visible layers.
                </div>
            ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {activeLayers.map(layer => {
                        const localHeight = localHeights[layer.id] ?? layer.heightOffset ?? 0;
                        const isDirty = dirtyLayers.has(layer.id);

                        return (
                            <div
                                key={layer.id}
                                className={`p-3 rounded-lg border transition-all ${isDirty
                                    ? 'bg-[#12B285]/5 border-[#12B285]/50 shadow-[0_0_10px_rgba(18,178,133,0.1)]'
                                    : 'bg-[#1C1B19]/50 border-[#57544F]/30 hover:border-[#57544F]/60'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-medium text-gray-300 flex items-center gap-1.5 truncate max-w-[140px]" title={layer.name}>
                                        {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#12B285] animate-pulse" />}
                                        {layer.name}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        {isDirty && (
                                            <button
                                                onClick={() => handleSave(layer)}
                                                disabled={isSaving}
                                                className="p-1 bg-[#12B285] text-white rounded hover:bg-[#12B285]/80 transition-colors"
                                                title="Save Changes"
                                            >
                                                <Save size={12} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleReset(layer.id)}
                                            className="p-1 text-carta-mist-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                                            title="Reset Changes"
                                        >
                                            <RefreshCw size={12} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="-500"
                                        max="500"
                                        step="1"
                                        value={localHeight}
                                        onChange={(e) => handleHeightChange(layer, parseFloat(e.target.value))}
                                        className="flex-1 accent-[#12B285] h-1.5 bg-[#57544F]/50 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <input
                                        type="number"
                                        value={localHeight}
                                        onChange={(e) => handleHeightChange(layer, parseFloat(e.target.value))}
                                        className="w-16 bg-[#1C1B19] border border-[#57544F] rounded px-1.5 py-0.5 text-xs text-white text-right focus:border-[#12B285] focus:outline-none"
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </ToolbarItem>
    );
};
