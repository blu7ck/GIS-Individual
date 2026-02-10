import React, { useState, useEffect } from 'react';
import { Folder, FileBox, Plus, Minus, Upload, ChevronRight, Eye, EyeOff, Share2, Map, Trash2, Box, Edit2, Check, X as XIcon, SlidersHorizontal, Save, AlertTriangle, Download, ExternalLink, Loader2, MousePointer2, RotateCcw } from 'lucide-react';

/**
 * Modern Number Input with +/- controls for better UX on both desktop and touch.
 */
const ModernNumberInput: React.FC<{
    value: number;
    step: number;
    min?: number;
    max?: number;
    onChange: (val: number) => void;
}> = ({ value, step, min, max, onChange }) => {
    const adjust = (delta: number) => {
        let newVal = parseFloat((value + delta).toFixed(2));
        if (min !== undefined && newVal < min) newVal = min;
        if (max !== undefined && newVal > max) newVal = max;
        onChange(newVal);
    };

    return (
        <div className="flex items-center h-7 bg-black/40 border border-white/10 rounded-lg overflow-hidden group focus-within:border-carta-gold-500/50 transition-all">
            <button
                type="button"
                onClick={() => adjust(-step)}
                className="h-full px-3 md:px-2 text-gray-500 hover:text-white hover:bg-white/5 transition-colors border-r border-white/5"
            >
                <Minus size={10} />
            </button>
            <input
                type="number"
                value={value}
                step={step}
                onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) onChange(v);
                }}
                className="w-14 bg-transparent text-[10px] text-carta-gold-500 text-center font-mono focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
                type="button"
                onClick={() => adjust(step)}
                className="h-full px-3 md:px-2 text-gray-500 hover:text-white hover:bg-white/5 transition-colors border-l border-white/5"
            >
                <Plus size={10} />
            </button>
        </div>
    );
};
import { Project, AssetLayer, LayerType, StorageConfig, AssetStatus } from '../../types';
import { Button } from '../common/Button';
import { StorageBar } from './StorageBar';

interface Props {
    projects: Project[];
    assets: AssetLayer[];
    selectedProjectId: string | null;
    onSelectProject: (id: string | null) => void;
    onCreateProject: (name: string) => void;
    onDeleteProject: (id: string) => void;
    onToggleLayer: (id: string) => void;
    onToggleAllLayers?: (projectId: string, visible: boolean) => void;
    onDeleteLayer: (id: string) => void;
    onShareProject?: (project: Project) => void;
    onShareLayer?: (layer: AssetLayer) => void;
    onLayerClick?: (layerId: string) => void;
    onOpenModelViewer?: (layer: AssetLayer) => void;
    onUpdateMeasurement?: (id: string, newName: string) => void;
    onUpdateAsset?: (id: string, newName: string, updates?: { heightOffset?: number; scale?: number; offsetX?: number; offsetY?: number; rotation?: number; position?: { lat: number; lng: number; height: number } }) => void;
    onOpenUpload?: (projectId: string) => void;
    onCancelUpload?: () => void;
    positioningLayerId?: string | null;
    setPositioningLayerId?: (id: string | null) => void;
    isPlacingOnMap?: string | null;
    setIsPlacingOnMap?: (id: string | null) => void;
    isUploading?: boolean;
    uploadProgress?: string;
    uploadProgressPercent?: number;
    externalCreateTrigger?: number; // Increment to trigger create mode
    storageConfig?: StorageConfig | null; // For storage bar
}

interface DeleteConfirmState {
    id: string;
    name: string;
    type: 'project' | 'layer';
}

export const ProjectPanel: React.FC<Props> = ({
    projects,
    assets,
    selectedProjectId,
    onSelectProject,
    onCreateProject,
    onDeleteProject,
    onToggleLayer,
    onToggleAllLayers,
    onDeleteLayer,
    onShareProject,
    onLayerClick,
    // onShareLayer, // Kept for interface compatibility but unused in this version
    onOpenModelViewer,
    onUpdateMeasurement,
    onUpdateAsset,
    onOpenUpload,
    onCancelUpload,
    positioningLayerId,
    setPositioningLayerId,
    isPlacingOnMap,
    setIsPlacingOnMap,
    isUploading,
    uploadProgress,
    uploadProgressPercent,
    externalCreateTrigger,
    storageConfig
}) => {
    // Stable random color generator for project folders
    const getProjectColor = (id: string) => {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F06292', '#AED581', '#FFD54F', '#4DB6AC', '#7986CB'
        ];
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = id.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash % colors.length)];
    };

    const getMeasurementColor = (mode?: string) => {
        const mapping: Record<string, string> = {
            'DISTANCE': '#FBBF24',
            'AREA': '#F97316',
            'SPOT_HEIGHT': '#D946EF',
            'SLOPE': '#84CC16',
            'LINE_OF_SIGHT': '#06B6D4',
            'CONVEX_HULL': '#A855F7',
            'PROFILE': '#3B82F6',
            'VOLUME': '#D97706'
        };
        return mapping[mode || ''] || '#3B82F6';
    };

    const getLayerTypeColor = (type: LayerType) => {
        switch (type) {
            case LayerType.KML: return '#FB923C'; // orange-400
            case LayerType.DXF: return '#F472B6'; // pink-400
            case LayerType.SHP: return '#22D3EE'; // cyan-400
            case LayerType.TILES_3D: return '#2DD4BF'; // teal-400
            case LayerType.POTREE: return '#818CF8'; // indigo-400
            case LayerType.LAS: return '#FB7185'; // rose-400
            case LayerType.GLB_UNCOORD: return '#C084FC'; // purple-400
            case LayerType.ANNOTATION: return '#3B82F6'; // default blue
            default: return '#9CA3AF'; // gray-400
        }
    };

    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedHeightControlId, setExpandedHeightControlId] = useState<string | null>(null);
    const [expandedInfoId, setExpandedInfoId] = useState<string | null>(null);
    const [localHeights, setLocalHeights] = useState<Record<string, number>>({});
    const [localTransforms, setLocalTransforms] = useState<Record<string, { height?: number; scale?: number; offsetX?: number; offsetY?: number; rotation?: number }>>({});
    const [previousPositions, setPreviousPositions] = useState<Record<string, { lat: number; lng: number; height: number }>>({});

    // Delete Confirmation State
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
    const [dontAskAgain, setDontAskAgain] = useState(false);

    // Initialize dontAskAgain from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('gis_individual_delete_dont_ask');
        if (stored === 'true') {
            setDontAskAgain(true);
        }
    }, []);

    // Handle external create trigger
    useEffect(() => {
        if (externalCreateTrigger && externalCreateTrigger > 0) {
            setIsCreating(true);
        }
    }, [externalCreateTrigger]);

    const toggleCategory = (projectId: string, category: string) => {
        const key = `${projectId}-${category}`;
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    const isCategoryExpanded = (projectId: string, category: string): boolean => {
        const key = `${projectId}-${category}`;
        return expandedCategories.has(key);
    };

    // Initialize categories as expanded by default
    useEffect(() => {
        projects
            .filter(project => !project.parent_project_id)
            .forEach(project => {
                const dataKey = `${project.id}-data`;
                const measurementsKey = `${project.id}-measurements`;
                setExpandedCategories(prev => {
                    const newSet = new Set(prev);
                    newSet.add(dataKey);
                    newSet.add(measurementsKey);
                    return newSet;
                });
            });
    }, [projects.length]);

    // Initialize local heights from assets
    useEffect(() => {
        const heights: Record<string, number> = {};
        assets.filter(a => a.type === LayerType.TILES_3D).forEach(layer => {
            if (localHeights[layer.id] === undefined) {
                heights[layer.id] = layer.heightOffset || 0;
            }
        });
        if (Object.keys(heights).length > 0) {
            setLocalHeights(prev => ({ ...prev, ...heights }));
        }
    }, [assets]);

    const handleEditStart = (layer: AssetLayer) => {
        setEditingMeasurementId(layer.id);
        setEditingName(layer.name);
    };

    const handleEditSave = () => {
        if (!editingMeasurementId || !editingName.trim()) return;

        const targetLayer = assets.find(a => a.id === editingMeasurementId);
        if (!targetLayer) return;

        if (targetLayer.type === LayerType.ANNOTATION && onUpdateMeasurement) {
            onUpdateMeasurement(editingMeasurementId, editingName.trim());
        } else if (onUpdateAsset) {
            onUpdateAsset(editingMeasurementId, editingName.trim());
        }

        setEditingMeasurementId(null);
        setEditingName('');
    };

    const handleEditCancel = () => {
        setEditingMeasurementId(null);
        setEditingName('');
    };


    const handleStartPlacement = (asset: AssetLayer) => {
        if (asset.position) {
            setPreviousPositions(prev => ({ ...prev, [asset.id]: { ...asset.position! } }));
        }
        if (setIsPlacingOnMap) setIsPlacingOnMap(asset.id);
    };

    const handleResetPosition = (asset: AssetLayer) => {
        const prev = previousPositions[asset.id];
        if (prev && onUpdateAsset) {
            onUpdateAsset(asset.id, asset.name, { position: prev });
        }
    };

    const handleRemovePosition = (asset: AssetLayer) => {
        if (onUpdateAsset) {
            onUpdateAsset(asset.id, asset.name, {
                position: null,
                heightOffset: 0,
                offsetX: 0,
                offsetY: 0,
                rotation: 0,
                scale: 1.0
            } as any);
            if (setPositioningLayerId) setPositioningLayerId(null);
            if (setIsPlacingOnMap) setIsPlacingOnMap(null);
        }
    };

    const handleHeightChange = (asset: AssetLayer, height: number) => {
        setLocalHeights(prev => ({ ...prev, [asset.id]: height }));
        // For real-time 3D Tiles preview (via window hack)
        const win = window as any;
        if (win.__fixurelabsApplyTransform) {
            win.__fixurelabsApplyTransform(asset.id, { height, scale: asset.scale || 1.0 });
        }
    };

    const handleHeightSave = (asset: AssetLayer) => {
        const height = localHeights[asset.id] ?? asset.heightOffset ?? 0;
        if (onUpdateAsset) {
            onUpdateAsset(asset.id, asset.name, { heightOffset: height });
        }
    };

    const handleHeightReset = (asset: AssetLayer) => {
        handleHeightChange(asset, 0);
    };

    const handleTransformChange = (asset: AssetLayer, field: string, value: number) => {
        if (isNaN(value)) return;

        const currentTransform = localTransforms[asset.id] || {
            height: asset.heightOffset || 0,
            scale: asset.scale || 1.0,
            offsetX: asset.offsetX || 0,
            offsetY: asset.offsetY || 0,
            rotation: asset.rotation || 0
        };

        const newTransform = { ...currentTransform, [field]: value };
        setLocalTransforms(prev => ({ ...prev, [asset.id]: newTransform }));

        // Real-time viewer update
        const win = window as any;
        if (win.__fixurelabsApplyTransform) {
            win.__fixurelabsApplyTransform(asset.id, newTransform);
        }
    };

    const handleSaveTransform = (asset: AssetLayer) => {
        const transform = localTransforms[asset.id];
        if (onUpdateAsset && transform) {
            onUpdateAsset(asset.id, asset.name, {
                heightOffset: transform.height,
                scale: transform.scale,
                offsetX: transform.offsetX,
                offsetY: transform.offsetY,
                rotation: transform.rotation
            });
            // Clear local states & exit mode
            setLocalTransforms(prev => {
                const next = { ...prev };
                delete next[asset.id];
                return next;
            });
            if (setPositioningLayerId) setPositioningLayerId(null);
        }
    };

    const handleFocus = (assetId: string) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset?.type === LayerType.POTREE || asset?.type === LayerType.LAS) {
            if (onOpenModelViewer) onOpenModelViewer(asset);
        } else if (onLayerClick) {
            onLayerClick(assetId);
        }
    };

    const handleDownload = (asset: AssetLayer) => {
        const url = asset.url || asset.blobUrl;
        if (!url) return;

        const link = document.createElement('a');
        link.href = url;
        link.download = asset.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newProjectName) {
            onCreateProject(newProjectName);
            setNewProjectName('');
            setIsCreating(false);
        }
    };

    // --- Delete Confirmation Logic ---
    const requestDeleteProject = (id: string, name: string) => {
        if (dontAskAgain) {
            onDeleteProject(id);
        } else {
            setDeleteConfirm({ id, name, type: 'project' });
        }
    };

    const requestDeleteLayer = (id: string, name: string) => {
        if (dontAskAgain) {
            onDeleteLayer(id);
        } else {
            setDeleteConfirm({ id, name, type: 'layer' });
        }
    };

    const confirmDelete = (shouldDontAskAgain: boolean) => {
        if (!deleteConfirm) return;

        if (shouldDontAskAgain) {
            localStorage.setItem('gis_individual_delete_dont_ask', 'true');
            setDontAskAgain(true);
        }

        if (deleteConfirm.type === 'project') {
            onDeleteProject(deleteConfirm.id);
        } else {
            onDeleteLayer(deleteConfirm.id);
        }
        setDeleteConfirm(null);
    };

    // Helper to render name with height
    const getDisplayName = (asset: AssetLayer) => {
        if (asset.status === AssetStatus.PROCESSING) {
            return (
                <span className="flex items-center gap-1.5 italic text-gray-400">
                    <Loader2 size={10} className="animate-spin text-engineering-primary" />
                    Processing: {asset.name}
                </span>
            );
        }

        const height = localHeights[asset.id] ?? asset.heightOffset ?? 0;
        if (height !== 0) {
            return (
                <span>
                    {asset.name}
                </span>
            );
        }
        return asset.name;
    };

    // Helper to render an asset item (to reduce duplication)
    const renderAssetItem = (asset: AssetLayer, customColor?: string) => {
        const isEditing = editingMeasurementId === asset.id;

        let icon: React.ReactNode;

        const lColor = getLayerTypeColor(asset.type);

        if (asset.type === LayerType.TILES_3D) {
            icon = <Map />;
        } else if (asset.type === LayerType.ANNOTATION) {
            const mode = (asset as any).data?.mode || 'DISTANCE';
            const mColor = getMeasurementColor(mode);
            icon = <SlidersHorizontal />;
            customColor = customColor || mColor;
        } else if (asset.type === LayerType.POTREE || asset.type === LayerType.LAS) {
            icon = <FileBox />;
        } else {
            icon = <Box />;
        }

        // Apply type color if no custom color is provided
        if (!customColor) {
            customColor = lColor;
        }

        return (
            <div key={asset.id} className="flex flex-col group/asset">
                <div className="flex items-center justify-between p-3 md:p-2 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300">
                    <div className="flex items-center overflow-hidden flex-1 min-w-0">
                        <div
                            className="p-1.5 rounded-lg mr-3 flex-shrink-0 transition-colors"
                            style={customColor ? { color: customColor, backgroundColor: `${customColor}15` } : {}}
                        >
                            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 14 }) : icon}
                        </div>

                        {isEditing ? (
                            <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEditSave();
                                    if (e.key === 'Escape') handleEditCancel();
                                }}
                                className="flex-1 bg-black/40 border border-cyan-500/50 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none ring-1 ring-cyan-500/20"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <div
                                className="flex flex-col min-w-0 cursor-pointer"
                                onClick={() => handleFocus(asset.id)}
                            >
                                <span
                                    className={`text-[11px] font-bold truncate transition-colors ${asset.visible ? '' : 'text-gray-500 opacity-50'}`}
                                    style={asset.visible ? { color: customColor } : {}}
                                    title={asset.name}
                                >
                                    {getDisplayName(asset)}
                                </span>
                                {asset.status === AssetStatus.READY && asset.type === LayerType.TILES_3D && (
                                    <span className="text-[9px] text-gray-600 font-mono tracking-tighter">
                                        SSE: 16 | {asset.heightOffset ? `${asset.heightOffset}m` : '0m'}
                                    </span>
                                )}
                                {asset.status === AssetStatus.ERROR && (
                                    <span className="flex items-center gap-1 text-[9px] text-red-500 font-medium">
                                        <AlertTriangle size={8} />
                                        {asset.error_message || 'İşlem Hatası'}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                        {isEditing ? (
                            <div className="flex items-center bg-black/40 rounded-lg border border-white/5 p-0.5">
                                <button onClick={handleEditSave} className="p-1 px-1.5 text-green-500 hover:text-green-400 hover:bg-white/5 rounded-md transition-all" title="Kaydet">
                                    <Check size={12} />
                                </button>
                                <button onClick={handleEditCancel} className="p-1 px-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-all" title="İptal">
                                    <XIcon size={12} />
                                </button>
                            </div>
                        ) : (
                            <div className={`flex items-center transition-all ${asset.visible ? 'opacity-100' : 'opacity-40 group-hover/asset:opacity-100'}`}>
                                <button
                                    onClick={() => onToggleLayer(asset.id)}
                                    className={`p-1.5 rounded-lg transition-all ${asset.visible ? 'text-white bg-white/10 hover:bg-white/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                    title={asset.visible ? 'Gizle' : 'Göster'}
                                    disabled={asset.status === AssetStatus.PROCESSING}
                                >
                                    {asset.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>

                                <div className="hidden group-hover/asset:flex items-center ml-1 bg-black/40 rounded-lg border border-white/5 p-0.5 animate-in fade-in slide-in-from-right-2 duration-200">
                                    {asset.type === LayerType.TILES_3D && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedHeightControlId(expandedHeightControlId === asset.id ? null : asset.id);
                                                setExpandedInfoId(null);
                                            }}
                                            className={`p-1.5 rounded-md transition-all ${expandedHeightControlId === asset.id ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                            title="Yükseklik Ayarı"
                                        >
                                            <SlidersHorizontal size={12} />
                                        </button>
                                    )}
                                    {/* ... more buttons ... */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDownload(asset); }}
                                        className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                                        title="İndir"
                                    >
                                        <Download size={12} />
                                    </button>
                                    <button
                                        onClick={() => handleEditStart(asset)}
                                        className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                                        title="Yeniden Adlandır"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={() => requestDeleteLayer(asset.id, asset.name)}
                                        className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                        title="Sil"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                    {asset.type === LayerType.GLB_UNCOORD && (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (setPositioningLayerId) {
                                                        setPositioningLayerId(positioningLayerId === asset.id ? null : asset.id);
                                                    }
                                                }}
                                                className={`p-1.5 rounded-md transition-colors ${positioningLayerId === asset.id ? 'text-emerald-400 bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                                title="Modelleme Ayarları"
                                            >
                                                <MousePointer2 size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onOpenModelViewer) onOpenModelViewer(asset);
                                                }}
                                                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                                title="3D Viewer'da Göster"
                                            >
                                                <ExternalLink size={12} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Inline Positioning Control (GLB only) */}
                {positioningLayerId === asset.id && asset.type === LayerType.GLB_UNCOORD && (
                    <div className="mt-2 p-3 mx-1 bg-white/[0.03] border border-white/10 rounded-2xl animate-in fade-in zoom-in-95 duration-300 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[11px] font-bold text-carta-gold-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Box size={14} />
                                Model Ayarları
                            </h4>
                            <button
                                onClick={() => {
                                    if (setPositioningLayerId) setPositioningLayerId(null);
                                    if (setIsPlacingOnMap) setIsPlacingOnMap(null);
                                }}
                                className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                                <XIcon size={14} />
                            </button>
                        </div>

                        {!asset.position && !isPlacingOnMap && (
                            <div className="space-y-3 py-4 text-center">
                                <p className="text-[11px] text-gray-400 px-2 italic">
                                    Model henüz haritaya yerleştirilmedi.
                                </p>
                                <Button
                                    size="sm"
                                    className="w-full h-10"
                                    onClick={() => handleStartPlacement(asset)}
                                >
                                    <MousePointer2 size={14} className="mr-2" />
                                    Haritaya Yerleştir
                                </Button>
                            </div>
                        )}

                        {isPlacingOnMap === asset.id && (
                            <div className="space-y-4 py-4 px-2 bg-carta-gold-500/5 rounded-lg border border-carta-gold-500/20 animate-pulse">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-carta-gold-500/20 flex items-center justify-center">
                                        <MousePointer2 size={18} className="text-carta-gold-500" />
                                    </div>
                                    <p className="text-[12px] text-carta-gold-500 font-medium text-center">
                                        Harita üzerinde yer seçiniz...
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="w-full h-8 text-[11px]"
                                    onClick={() => { if (setIsPlacingOnMap) setIsPlacingOnMap(null); }}
                                >
                                    İptal
                                </Button>
                            </div>
                        )}

                        {(asset.position && isPlacingOnMap !== asset.id) && (
                            <div className="space-y-4">
                                {/* Transformation Controls */}
                                {['height', 'offsetX', 'offsetY', 'rotation', 'scale'].map((field) => {
                                    const transform = localTransforms[asset.id] || {
                                        height: asset.heightOffset || 0,
                                        scale: asset.scale || 1.0,
                                        offsetX: asset.offsetX || 0,
                                        offsetY: asset.offsetY || 0,
                                        rotation: asset.rotation || 0
                                    };

                                    const labels: Record<string, string> = {
                                        height: 'Yükseklik (Z)',
                                        offsetX: 'Kaydırma (X)',
                                        offsetY: 'Kaydırma (Y)',
                                        rotation: 'Döndürme (R)',
                                        scale: 'Ölçek (S)'
                                    };

                                    const ranges: Record<string, { min: number, max: number, step: number }> = {
                                        height: { min: -100, max: 100, step: 0.1 },
                                        offsetX: { min: -50, max: 50, step: 0.1 },
                                        offsetY: { min: -50, max: 50, step: 0.1 },
                                        rotation: { min: 0, max: 360, step: 1 },
                                        scale: { min: 0.1, max: 10, step: 0.1 }
                                    };

                                    const val = (transform as any)[field];
                                    const range = ranges[field]!;

                                    return (
                                        <div key={field} className="space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] text-gray-400 font-medium">{labels[field]}</label>
                                                <ModernNumberInput
                                                    value={val}
                                                    step={range.step}
                                                    min={range.min}
                                                    max={range.max}
                                                    onChange={v => handleTransformChange(asset, field, v)}
                                                />
                                            </div>
                                            <input
                                                type="range"
                                                min={range.min}
                                                max={range.max}
                                                step={range.step}
                                                value={val}
                                                onChange={e => handleTransformChange(asset, field, parseFloat(e.target.value))}
                                                className="w-full accent-carta-gold-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                    );
                                })}

                                <div className="pt-2 flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            className="flex-1 h-9 font-bold"
                                            onClick={() => handleSaveTransform(asset)}
                                        >
                                            <Save size={14} className="mr-1.5" />
                                            Kaydet
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className={`h-9 w-9 p-0 flex items-center justify-center border-white/10 transition-all ${isPlacingOnMap === asset.id ? 'bg-carta-gold-500 text-white' : ''}`}
                                            onClick={() => handleStartPlacement(asset)}
                                            title="Yeniden Konumlandır"
                                        >
                                            <MousePointer2 size={14} />
                                        </Button>
                                    </div>
                                    <div className="flex gap-2">
                                        {previousPositions[asset.id] && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="flex-1 h-8 text-[10px] bg-white/5 hover:bg-white/10 text-gray-400 border-white/10"
                                                onClick={() => handleResetPosition(asset)}
                                            >
                                                <RotateCcw size={12} className="mr-1.5" />
                                                Önceki Konum
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            className="flex-1 h-8 text-[10px]"
                                            onClick={() => handleRemovePosition(asset)}
                                        >
                                            <Trash2 size={12} className="mr-1.5" />
                                            Haritadan Kaldır
                                        </Button>
                                    </div>
                                    <p className="text-[9px] text-gray-500 text-center italic">
                                        Kayıt butonuna basana kadar değişiklikler kalıcı olmaz.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Inline Height Control (Only for 3D Tiles) */}
                {
                    expandedHeightControlId === asset.id && asset.type === LayerType.TILES_3D && (
                        <div className="mt-2 p-3 bg-[#0f0f0f] border border-white/10 rounded-2xl animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-carta-gold-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <SlidersHorizontal size={12} />
                                    Yükseklik Ayarı (m)
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleHeightReset(asset)}
                                        className="p-1 text-gray-400 hover:text-white transition-colors"
                                        title="Sıfırla"
                                    >
                                        <RotateCcw size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleHeightSave(asset)}
                                        className="p-1 text-carta-gold-500 hover:text-carta-gold-400 transition-colors"
                                        title="Kaydet"
                                    >
                                        <Save size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="-1000"
                                    max="1000"
                                    step="0.1"
                                    value={localHeights[asset.id] ?? asset.heightOffset ?? 0}
                                    onChange={(e) => handleHeightChange(asset, parseFloat(e.target.value))}
                                    className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-carta-gold-500"
                                />
                                <ModernNumberInput
                                    value={localHeights[asset.id] ?? asset.heightOffset ?? 0}
                                    step={1}
                                    onChange={(v) => handleHeightChange(asset, v)}
                                />
                            </div>
                        </div>
                    )
                }

                {/* Inline Info Panel */}
                {
                    expandedInfoId === asset.id && (
                        <div className="mt-1 mb-2 mx-1 p-3 bg-carta-deep-800 border border-carta-gold-500/20 rounded-xl animate-in fade-in zoom-in-95 duration-200 text-[10px]">
                            <div className="space-y-2">
                                <div className="flex justify-between border-b border-white/5 pb-1">
                                    <span className="text-gray-500 uppercase font-bold tracking-wider">Tür</span>
                                    <span className="text-carta-gold-500 font-mono font-bold">{asset.type}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 uppercase font-bold tracking-wider">Depolama Yolu</span>
                                    <span className="text-[9px] text-gray-400 break-all bg-black/40 p-2 rounded-lg font-mono border border-white/5">{asset.storage_path}</span>
                                </div>
                                <div className="pt-1">
                                    <button
                                        onClick={() => asset.url && window.open(asset.url, '_blank')}
                                        className="w-full h-8 flex items-center justify-center gap-2 bg-carta-gold-500/10 hover:bg-carta-gold-500/20 text-carta-gold-500 rounded-lg border border-carta-gold-500/20 transition-all font-bold"
                                    >
                                        <ExternalLink size={12} />
                                        <span>Bağlantıyı Aç</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        );
    };

    return (
        <div className="h-full flex flex-col overflow-hidden relative">
            <div className="flex flex-col h-full bg-transparent text-white">
                {/* Fixed Header */}
                <div className="p-4 border-b border-white/5 bg-black/10 backdrop-blur-xl flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <h2 className="text-[15px] font-bold text-white tracking-tight">Projelerim</h2>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Çalışma Alanı</p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => setIsCreating(!isCreating)}
                            className="bg-[#06B6D4] hover:bg-[#0891B2] text-white shadow-lg shadow-cyan-500/20 flex items-center gap-2 px-4 h-9 rounded-xl transition-all border-none font-bold text-[12px]"
                        >
                            <Plus size={16} />
                            <span>Yeni Proje</span>
                        </Button>
                    </div>
                </div>

                {/* Fixed New Project Form */}
                {isCreating && (
                    <div className="p-4 border-b border-white/5 bg-white/[0.02] animate-in slide-in-from-top-4 duration-300">
                        <form onSubmit={handleCreate} className="space-y-3">
                            <div className="relative">
                                <Folder className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Proje adını giriniz..."
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 outline-none transition-all"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="secondary" className="flex-1 h-9 rounded-xl text-[12px] font-bold" onClick={() => setIsCreating(false)} type="button">İptal</Button>
                                <Button size="sm" type="submit" className="flex-[2] h-9 rounded-xl text-[12px] font-bold shadow-lg shadow-cyan-500/10 bg-cyan-600 hover:bg-cyan-500 border-none">Oluştur</Button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Project List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {projects.length === 0 && !isCreating && (
                        <div className="flex flex-col items-center justify-center h-40 text-center space-y-3 animate-in fade-in duration-700">
                            <div className="p-4 rounded-full bg-white/5 text-gray-600">
                                <Folder size={32} />
                            </div>
                            <p className="text-gray-500 text-xs font-medium">Henüz proje oluşturulmadı.<br />Başlamak için yeni bir proje oluşturun.</p>
                        </div>
                    )}

                    {projects
                        .filter(project => !project.parent_project_id)
                        .map(project => {
                            const isSelected = selectedProjectId === project.id;
                            const projectAssets = assets.filter(a => a.project_id === project.id && a.type !== LayerType.ANNOTATION);
                            const measurementsSubProjects = projects.filter(p =>
                                p.parent_project_id === project.id &&
                                p.is_measurements_folder &&
                                !p.linked_asset_id &&
                                assets.some(a => a.project_id === p.id)
                            );

                            return (
                                <div key={project.id} className="rounded-lg overflow-hidden border border-transparent transition-all">
                                    {/* Project Header */}
                                    <div
                                        onClick={() => !project.is_measurements_folder && onSelectProject(isSelected ? null : project.id)}
                                        className={`flex items-center p-3 cursor-pointer transition-all duration-300 rounded-xl mb-2 mx-1 shadow-sm border
                                            ${isSelected
                                                ? 'bg-white/[0.05] border-white/20 ring-1 ring-white/5'
                                                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                                            }
                                        `}
                                    >
                                        <div
                                            className={`p-2 rounded-lg mr-3 transition-colors ${isSelected ? 'bg-white/10 shadow-lg' : 'bg-white/5'}`}
                                            style={{ color: getProjectColor(project.id) }}
                                        >
                                            <Folder size={18} />
                                        </div>

                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className={`text-[13px] font-bold truncate transition-colors ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                                {project.name}
                                            </span>
                                            <span className="text-[10px] text-gray-600 font-medium">
                                                {projectAssets.length} Katman | {measurementsSubProjects.length} Ölçüm
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            {isSelected && !project.is_measurements_folder ? (
                                                <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-white/5 animate-in fade-in zoom-in-95 duration-200">
                                                    {onToggleAllLayers && projectAssets.length > 0 && (() => {
                                                        const allVisible = projectAssets.every(a => a.visible);
                                                        return (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onToggleAllLayers(project.id, !allVisible);
                                                                }}
                                                                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition"
                                                                title={allVisible ? "Tümünü Gizle" : "Tümünü Göster"}
                                                            >
                                                                {allVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                                            </button>
                                                        );
                                                    })()}
                                                    {onShareProject && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onShareProject(project);
                                                            }}
                                                            className="p-1.5 rounded-md text-gray-400 hover:text-carta-forest-400 hover:bg-white/10 transition"
                                                            title="Projeyi Paylaş"
                                                        >
                                                            <Share2 size={14} />
                                                        </button>
                                                    )}
                                                    {onOpenUpload && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onOpenUpload(project.id);
                                                            }}
                                                            className="p-1.5 rounded-md text-gray-400 hover:text-engineering-primary hover:bg-white/10 transition"
                                                            title="Dosya Yükle"
                                                        >
                                                            <Upload size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); requestDeleteProject(project.id, project.name); }}
                                                        className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition"
                                                        title="Projeyi Sil"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <ChevronRight size={16} className={`text-gray-600 transition-transform duration-300 ${isSelected ? 'rotate-90' : ''}`} />
                                            )}
                                        </div>
                                    </div>

                                    {/* Assets List (Only if project selected) */}
                                    {isSelected && !project.is_measurements_folder && (
                                        <div className="pl-3 pr-1 py-1 space-y-2 ml-4 border-l border-white/5 my-2">
                                            {projectAssets.length === 0 && measurementsSubProjects.length === 0 && (
                                                <div className="text-[10px] text-gray-600 italic py-4 text-center bg-white/[0.02] rounded-xl border border-dashed border-white/5 mx-2">
                                                    Proje henüz boş. Dosya yükleyerek başlayın.
                                                </div>
                                            )}

                                            {/* Data Category */}
                                            {projectAssets.length > 0 && (
                                                <div className="space-y-1">
                                                    <div
                                                        onClick={() => toggleCategory(project.id, 'data')}
                                                        className="flex items-center p-2 cursor-pointer hover:bg-white/5 rounded-lg transition-colors group/cat"
                                                    >
                                                        <ChevronRight
                                                            size={12}
                                                            className={`mr-2 text-gray-600 transition-transform duration-300 ${isCategoryExpanded(project.id, 'data') ? 'rotate-90' : ''}`}
                                                        />
                                                        <Folder size={14} className="mr-2 text-gray-500 group-hover/cat:text-gray-300 transition-colors" />
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover/cat:text-gray-300 transition-colors">VERİ KATMANLARI</span>
                                                    </div>
                                                    {isCategoryExpanded(project.id, 'data') && (
                                                        <div className="pl-4 space-y-1 mt-1">
                                                            {/* KML Files */}
                                                            {projectAssets.filter(a => a.type === LayerType.KML).length > 0 && (
                                                                <div className="mb-1">
                                                                    <div className="text-[10px] text-carta-mist-500 font-medium mb-1 px-1">KML Files</div>
                                                                    {projectAssets.filter(a => a.type === LayerType.KML).map(asset =>
                                                                        renderAssetItem(asset, '#EA580C')
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* 3D Tiles */}
                                                            {projectAssets.filter(a => a.type === LayerType.TILES_3D).length > 0 && (
                                                                <div className="mb-1">
                                                                    <div className="text-[10px] text-carta-mist-500 font-medium mb-1 px-1">3D Tiles</div>
                                                                    {projectAssets.filter(a => a.type === LayerType.TILES_3D).map(asset => {
                                                                        const tilesetMeasurements = projects.find(p => p.parent_project_id === project.id && p.linked_asset_id === asset.id && p.is_measurements_folder);
                                                                        const tilesetMeasurementsAssets = tilesetMeasurements ? assets.filter(a => a.project_id === tilesetMeasurements.id) : [];

                                                                        return (
                                                                            <div key={asset.id}>
                                                                                {renderAssetItem(asset, '#2DD4BF')}

                                                                                {/* Measurements for this 3D Tile */}
                                                                                {tilesetMeasurements && tilesetMeasurementsAssets.length > 0 && (
                                                                                    <div className="pl-4 ml-4 border-l-2 border-carta-gold-600/30 mt-1 mb-2">
                                                                                        <div className="text-[10px] text-carta-gold-400/70 font-semibold mb-1 flex items-center">
                                                                                            <Map size={10} className="mr-1" />
                                                                                            Measurements ({tilesetMeasurementsAssets.length})
                                                                                        </div>
                                                                                        {tilesetMeasurementsAssets.map(measurement => (
                                                                                            <div key={measurement.id} className="group flex items-center justify-between p-1 rounded hover:bg-[#57544F]/20 transition">
                                                                                                <div className="flex items-center overflow-hidden flex-1">
                                                                                                    <Map size={12} className="text-carta-gold-500 mr-2 flex-shrink-0" />
                                                                                                    {editingMeasurementId === measurement.id ? (
                                                                                                        <input
                                                                                                            type="text"
                                                                                                            value={editingName}
                                                                                                            onChange={(e) => setEditingName(e.target.value)}
                                                                                                            onKeyDown={(e) => {
                                                                                                                if (e.key === 'Enter') handleEditSave();
                                                                                                                if (e.key === 'Escape') handleEditCancel();
                                                                                                            }}
                                                                                                            className="flex-1 bg-carta-deep-700 border border-carta-gold-500 rounded px-2 py-0.5 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-carta-gold-500"
                                                                                                            autoFocus
                                                                                                        />
                                                                                                    ) : (
                                                                                                        <span className="text-[11px] truncate text-carta-gold-300" title={measurement.name}>
                                                                                                            {measurement.name}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                                                                                                    {editingMeasurementId === measurement.id ? (
                                                                                                        <>
                                                                                                            <button onClick={handleEditSave} className="text-carta-mist-500 hover:text-green-400" title="Save">
                                                                                                                <Check size={11} />
                                                                                                            </button>
                                                                                                            <button onClick={handleEditCancel} className="text-carta-mist-500 hover:text-red-400" title="Cancel">
                                                                                                                <XIcon size={11} />
                                                                                                            </button>
                                                                                                        </>
                                                                                                    ) : (
                                                                                                        <>
                                                                                                            <button onClick={() => onToggleLayer(measurement.id)} className="text-carta-mist-500 hover:text-white" title="Toggle Visibility">
                                                                                                                {measurement.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                                                                                                            </button>
                                                                                                            <button onClick={() => handleEditStart(measurement)} className="text-carta-mist-500 hover:text-carta-gold-400" title="Rename">
                                                                                                                <Edit2 size={11} />
                                                                                                            </button>
                                                                                                            <button onClick={() => requestDeleteLayer(measurement.id, measurement.name)} className="text-carta-mist-500 hover:text-carta-accent-red" title="Delete">
                                                                                                                <Trash2 size={11} />
                                                                                                            </button>
                                                                                                        </>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}

                                                            {/* DXF Files */}
                                                            {projectAssets.filter(a => a.type === LayerType.DXF).length > 0 && (
                                                                <div className="mb-1">
                                                                    <div className="text-[10px] text-gray-500 font-medium mb-1 px-1">DXF Files</div>
                                                                    {projectAssets.filter(a => a.type === LayerType.DXF).map(asset =>
                                                                        renderAssetItem(asset, '#EC4899')
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Shapefiles */}
                                                            {projectAssets.filter(a => a.type === LayerType.SHP).length > 0 && (
                                                                <div className="mb-1">
                                                                    <div className="text-[10px] text-gray-500 font-medium mb-1 px-1">Shapefiles</div>
                                                                    {projectAssets.filter(a => a.type === LayerType.SHP).map(asset =>
                                                                        renderAssetItem(asset, '#06B6D4')
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* GLB/GLTF */}
                                                            {projectAssets.filter(a => a.type === LayerType.GLB_UNCOORD).length > 0 && (
                                                                <div className="mb-1">
                                                                    <div className="text-[10px] text-gray-500 font-medium mb-1 px-1">GLB/GLTF</div>
                                                                    {projectAssets.filter(a => a.type === LayerType.GLB_UNCOORD).map(asset =>
                                                                        renderAssetItem(asset, '#A855F7')
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Point Clouds (Potree & LAS) */}
                                                            {projectAssets.filter(a => a.type === LayerType.POTREE || a.type === LayerType.LAS).length > 0 && (
                                                                <div className="mb-1">
                                                                    <div className="text-[10px] text-gray-500 font-medium mb-1 px-1">Point Clouds</div>
                                                                    {projectAssets.filter(a => a.type === LayerType.POTREE || a.type === LayerType.LAS).map(asset =>
                                                                        renderAssetItem(asset, '#0EA5E9')
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Level 1 Measurements Category */}
                                            {measurementsSubProjects.length > 0 && (
                                                <div className="space-y-1">
                                                    <div
                                                        onClick={() => toggleCategory(project.id, 'measurements')}
                                                        className="flex items-center p-2 cursor-pointer hover:bg-white/5 rounded-lg transition-colors group/cat"
                                                    >
                                                        <ChevronRight
                                                            size={12}
                                                            className={`mr-2 text-gray-600 transition-transform duration-300 ${isCategoryExpanded(project.id, 'measurements') ? 'rotate-90' : ''}`}
                                                        />
                                                        <Folder size={14} className="mr-2 text-gray-500 group-hover/cat:text-gray-300 transition-colors" />
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover/cat:text-gray-300 transition-colors">ÖLÇÜM VE ANALİZLER</span>
                                                    </div>
                                                    {isCategoryExpanded(project.id, 'measurements') && (
                                                        <div className="pl-4 space-y-1 mt-1">
                                                            {measurementsSubProjects.map(measurementProject => {
                                                                const measurementAssets = assets.filter(a => a.project_id === measurementProject.id);
                                                                return measurementAssets.map(measurement => (
                                                                    <div key={measurement.id} className="group/measurement flex items-center justify-between p-2 rounded-xl border border-transparent hover:border-white/5 hover:bg-white/[0.03] transition-all duration-300">
                                                                        <div className="flex items-center overflow-hidden flex-1 min-w-0">
                                                                            <div
                                                                                className="p-1.5 rounded-lg mr-3 flex-shrink-0 transition-colors"
                                                                                style={{
                                                                                    backgroundColor: `${getMeasurementColor((measurement as any).data?.mode)}20`,
                                                                                    color: getMeasurementColor((measurement as any).data?.mode)
                                                                                }}
                                                                            >
                                                                                <SlidersHorizontal size={14} />
                                                                            </div>
                                                                            {editingMeasurementId === measurement.id ? (
                                                                                <input
                                                                                    type="text"
                                                                                    value={editingName}
                                                                                    onChange={(e) => setEditingName(e.target.value)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') handleEditSave();
                                                                                        if (e.key === 'Escape') handleEditCancel();
                                                                                    }}
                                                                                    className="flex-1 bg-black/40 border border-carta-gold-500/50 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none ring-1 ring-carta-gold-500/20"
                                                                                    autoFocus
                                                                                />
                                                                            ) : (
                                                                                <span
                                                                                    className={`text-[11px] font-bold truncate transition-colors cursor-pointer ${measurement.visible ? '' : 'text-gray-500 opacity-50'}`}
                                                                                    style={measurement.visible ? { color: getMeasurementColor((measurement as any).data?.mode) } : {}}
                                                                                    title={measurement.name}
                                                                                    onClick={() => handleFocus(measurement.id)}
                                                                                >
                                                                                    {measurement.name}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover/measurement:opacity-100 transition-opacity">
                                                                            <div className="flex items-center bg-black/40 rounded-lg border border-white/5 p-0.5">
                                                                                <button onClick={() => onToggleLayer(measurement.id)} className={`p-1 px-1.5 transition-all ${measurement.visible ? 'text-white hover:text-white' : 'text-gray-500 hover:text-white'}`} title="Göster/Gizle">
                                                                                    {measurement.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                                                                                </button>
                                                                                <button onClick={() => handleEditStart(measurement)} className="p-1 px-1.5 text-gray-500 hover:text-carta-gold-400 transition-all" title="Adlandır">
                                                                                    <Edit2 size={11} />
                                                                                </button>
                                                                                <button onClick={() => requestDeleteLayer(measurement.id, measurement.name)} className="p-1 px-1.5 text-gray-500 hover:text-red-500 transition-all" title="Sil">
                                                                                    <Trash2 size={11} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ));
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>

                {/* Upload Progress Area */}
                {isUploading && (
                    <div className="px-4 py-2 bg-engineering-primary/5 border-t border-engineering-border/30 animate-in slide-in-from-bottom-1 relative">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-medium text-engineering-primary uppercase tracking-wider">Uploading Assets...</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-engineering-primary">{uploadProgressPercent?.toFixed(0)}%</span>
                                {onCancelUpload && (
                                    <button
                                        onClick={onCancelUpload}
                                        className="text-engineering-primary hover:text-red-400 transition-colors"
                                        title="Cancel Upload"
                                    >
                                        <XIcon size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-engineering-primary transition-all duration-300 ease-out shadow-[0_0_8px_rgba(18,178,133,0.4)]"
                                style={{ width: `${uploadProgressPercent}%` }}
                            />
                        </div>
                        {uploadProgress && (
                            <div className="mt-1 text-[9px] text-gray-500 truncate italic">
                                {uploadProgress}
                            </div>
                        )}
                    </div>
                )}

                {/* Fixed Storage Footer */}
                <div className="p-4 border-t border-engineering-border bg-engineering-panel/50 backdrop-blur-sm flex-shrink-0">
                    <StorageBar storageConfig={storageConfig || null} maxStorageGB={10} />
                </div>
            </div>

            {/* Delete Confirmation Modal Overlay */}
            {deleteConfirm && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-[#1C1B19] border border-engineering-border rounded-lg shadow-2xl w-full max-w-[300px] p-4 text-center">
                        <div className="flex justify-center mb-3 text-carta-accent-red">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-white font-semibold mb-2">Delete {deleteConfirm.type === 'project' ? 'Project' : 'Item'}?</h3>
                        <p className="text-carta-mist-400 text-xs mb-4">
                            Are you sure you want to delete <span className="font-bold text-white">"{deleteConfirm.name}"</span>? This action cannot be undone.
                        </p>

                        <div className="flex items-center justify-center gap-2 mb-4">
                            <input
                                type="checkbox"
                                id="dontAskAgain"
                                className="w-3 h-3 accent-engineering-primary"
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        // We don't save yet, only on confirm
                                    }
                                }}
                            />
                            <label htmlFor="dontAskAgain" className="text-[10px] text-carta-mist-500 cursor-pointer select-none">
                                Don't ask again
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                    const checkbox = document.getElementById('dontAskAgain') as HTMLInputElement;
                                    confirmDelete(checkbox?.checked);
                                }}
                                className="flex-1"
                            >
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
