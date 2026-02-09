import React, { useState, useEffect } from 'react';
import { Folder, FileBox, Plus, Upload, ChevronRight, ChevronDown, Eye, EyeOff, Share2, Map, Trash2, Box, Edit2, Check, X as XIcon, SlidersHorizontal, RefreshCw, Save, AlertTriangle, Download, ExternalLink, Loader2 } from 'lucide-react';
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
    onUpdateAsset?: (id: string, newName: string, updates?: { heightOffset?: number; scale?: number }) => void;
    onOpenUpload?: (projectId: string) => void;
    onCancelUpload?: () => void;
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
    // onShareLayer, // Kept for interface compatibility but unused in this version
    onLayerClick,
    onOpenModelViewer,
    onUpdateMeasurement,
    onUpdateAsset,
    onOpenUpload,
    onCancelUpload,
    isUploading,
    uploadProgress,
    uploadProgressPercent,
    externalCreateTrigger,
    storageConfig
}) => {
    const [newProjectName, setNewProjectName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [editingMeasurementId, setEditingMeasurementId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedHeightControlId, setExpandedHeightControlId] = useState<string | null>(null);
    const [expandedInfoId, setExpandedInfoId] = useState<string | null>(null);
    const [localHeights, setLocalHeights] = useState<Record<string, number>>({});

    // Delete Confirmation State
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
    const [dontAskAgain, setDontAskAgain] = useState(false);

    // Initialize dontAskAgain from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('hekamap_delete_dont_ask');
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

    const handleHeightChange = (asset: AssetLayer, newHeight: number) => {
        setLocalHeights(prev => ({ ...prev, [asset.id]: newHeight }));

        // Real-time transform for the viewer
        const win = window as any;
        if (win.__fixurelabsApplyTransform) {
            win.__fixurelabsApplyTransform(asset.id, newHeight, asset.scale ?? 1);
        }
    };

    const handleHeightSave = (asset: AssetLayer) => {
        const newHeight = localHeights[asset.id] ?? asset.heightOffset ?? 0;
        if (onUpdateAsset) {
            onUpdateAsset(asset.id, asset.name, { heightOffset: newHeight });
        }
        setExpandedHeightControlId(null);
    };

    const handleHeightReset = (asset: AssetLayer) => {
        handleHeightChange(asset, 0);
    };

    const handleFocus = (assetId: string) => {
        const asset = assets.find(a => a.id === assetId);
        if (asset?.type === LayerType.POTREE) {
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
            localStorage.setItem('hekamap_delete_dont_ask', 'true');
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
    const renderAssetItem = (asset: AssetLayer, icon: React.ReactNode, typeColorClass: string) => {
        const isEditing = editingMeasurementId === asset.id;

        return (
            <div key={asset.id} className="flex flex-col">
                <div className="group flex items-center justify-between p-1.5 rounded hover:bg-[#57544F]/20 transition">
                    <div className="flex items-center overflow-hidden flex-1">
                        <div className={`${typeColorClass} mr-2 flex-shrink-0`}>{icon}</div>

                        {isEditing ? (
                            <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEditSave();
                                    if (e.key === 'Escape') handleEditCancel();
                                }}
                                className={`flex-1 bg-[#1C1B19] border border-opacity-50 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-opacity-50`}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span
                                className={`text-xs truncate flex-1 cursor-pointer transition-colors ${asset.visible ? 'text-gray-300 hover:text-white' : 'text-gray-500'}`}
                                title={asset.name}
                                onClick={() => handleFocus(asset.id)}
                            >
                                {getDisplayName(asset)}
                                {asset.status === AssetStatus.ERROR && (
                                    <span title={asset.error_message || 'Processing failed'} className="ml-1.5 flex-shrink-0">
                                        <AlertTriangle size={10} className="text-red-500" />
                                    </span>
                                )}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                        {isEditing ? (
                            <>
                                <button onClick={handleEditSave} className="text-carta-mist-500 hover:text-green-400" title="Save">
                                    <Check size={12} />
                                </button>
                                <button onClick={handleEditCancel} className="text-carta-mist-500 hover:text-red-400" title="Cancel">
                                    <XIcon size={12} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => onToggleLayer(asset.id)}
                                    className={`text-carta-mist-500 hover:text-white ${asset.status === AssetStatus.PROCESSING ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    title={asset.status === AssetStatus.PROCESSING ? 'Processing...' : 'Toggle Visibility'}
                                    disabled={asset.status === AssetStatus.PROCESSING}
                                >
                                    {asset.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>
                                {asset.type === LayerType.TILES_3D && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedHeightControlId(expandedHeightControlId === asset.id ? null : asset.id);
                                            setExpandedInfoId(null);
                                        }}
                                        className={`text-carta-mist-500 hover:text-engineering-primary ${expandedHeightControlId === asset.id ? 'text-engineering-primary' : ''}`}
                                        title="Adjust Height"
                                    >
                                        <SlidersHorizontal size={12} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(asset);
                                    }}
                                    className="text-carta-mist-500 hover:text-white"
                                    title="Download Original"
                                >
                                    <Download size={12} />
                                </button>
                                <button onClick={() => handleEditStart(asset)} className="text-carta-mist-500 hover:text-white" title="Rename">
                                    <Edit2 size={12} />
                                </button>
                                <button
                                    onClick={() => requestDeleteLayer(asset.id, asset.name)}
                                    className="text-carta-mist-500 hover:text-carta-accent-red"
                                    title="Delete"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Inline Height Control (Only for 3D Tiles) */}
                {
                    expandedHeightControlId === asset.id && asset.type === LayerType.TILES_3D && (
                        <div className="mt-2 p-2 bg-engineering-panel/50 border border-engineering-border/50 rounded-lg animate-in slide-in-from-top-1">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-medium text-engineering-primary uppercase tracking-wider">Adjustment (m)</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleHeightReset(asset)}
                                        className="p-1 text-gray-500 hover:text-white transition-colors"
                                        title="Reset"
                                    >
                                        <RefreshCw size={10} />
                                    </button>
                                    <button
                                        onClick={() => handleHeightSave(asset)}
                                        className="p-1 text-engineering-primary hover:text-engineering-primary/80 transition-colors"
                                        title="Save"
                                    >
                                        <Save size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="-500"
                                    max="500"
                                    step="1"
                                    value={localHeights[asset.id] ?? asset.heightOffset ?? 0}
                                    onChange={(e) => handleHeightChange(asset, parseFloat(e.target.value))}
                                    className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-engineering-primary"
                                />
                                <input
                                    type="number"
                                    value={localHeights[asset.id] ?? asset.heightOffset ?? 0}
                                    onChange={(e) => handleHeightChange(asset, parseFloat(e.target.value))}
                                    className="w-12 bg-black/20 border border-engineering-border rounded px-1 py-0.5 text-[10px] text-white text-right focus:border-engineering-primary outline-none"
                                />
                            </div>
                        </div>
                    )
                }

                {/* Inline Info Panel */}
                {
                    expandedInfoId === asset.id && (
                        <div className="mt-1 mb-2 mx-1 p-3 bg-engineering-panel/50 border border-engineering-border/50 rounded-lg animate-in slide-in-from-top-1 text-[10px]">
                            <div className="space-y-2">
                                <div className="flex justify-between border-b border-engineering-border/30 pb-1">
                                    <span className="text-gray-500 uppercase">Type</span>
                                    <span className="text-engineering-primary font-mono">{asset.type}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 uppercase">Storage Path</span>
                                    <span className="text-[9px] text-gray-400 break-all bg-black/20 p-1 rounded font-mono">{asset.storage_path}</span>
                                </div>
                                <div className="pt-1">
                                    <button
                                        onClick={() => asset.url && window.open(asset.url, '_blank')}
                                        className="w-full flex items-center justify-center gap-1 p-1 bg-engineering-primary/10 hover:bg-engineering-primary/20 text-engineering-primary rounded border border-engineering-primary/20 transition-all"
                                    >
                                        <ExternalLink size={10} />
                                        <span>Open URL</span>
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
                <div className="p-4 border-b border-engineering-border bg-engineering-panel/50 backdrop-blur-sm flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Plus size={18} className="text-engineering-primary" />
                            <h2 className="text-sm font-semibold text-white">Projects</h2>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => setIsCreating(!isCreating)}
                            className="bg-engineering-primary/20 hover:bg-engineering-primary/30 text-engineering-primary border-engineering-primary/30 flex items-center gap-1 px-3 py-1 h-8 rounded-lg transition-all"
                        >
                            <Plus size={14} />
                            <span>Create</span>
                        </Button>
                    </div>
                </div>

                {/* Fixed New Project Form */}
                {isCreating && (
                    <form onSubmit={handleCreate} className="p-3 border-b border-[#57544F] bg-[#1C1B19]/50 animate-in slide-in-from-top-2">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Project Name..."
                            value={newProjectName}
                            onChange={e => setNewProjectName(e.target.value)}
                            className="w-full bg-engineering-panel border border-engineering-border rounded p-2 text-sm text-white mb-2 focus:border-engineering-primary outline-none"
                        />
                        <div className="flex justify-end space-x-2">
                            <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)} type="button">Cancel</Button>
                            <Button size="sm" type="submit" className="bg-engineering-primary hover:bg-engineering-primary/80 text-white border-none">Create</Button>
                        </div>
                    </form>
                )}

                {/* Project List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {projects.length === 0 && !isCreating && (
                        <div className="text-center text-carta-mist-500 text-xs mt-10">
                            No projects yet.<br />Create one to start uploading.
                        </div>
                    )}

                    {projects
                        .filter(project => !project.parent_project_id)
                        .map(project => {
                            const isSelected = selectedProjectId === project.id;
                            const projectAssets = assets.filter(a => a.project_id === project.id && a.type !== LayerType.ANNOTATION);
                            const measurementsSubProjects = projects.filter(p => p.parent_project_id === project.id && p.is_measurements_folder && !p.linked_asset_id);

                            return (
                                <div key={project.id} className="rounded-lg overflow-hidden border border-transparent transition-all">
                                    {/* Project Header */}
                                    <div
                                        onClick={() => !project.is_measurements_folder && onSelectProject(isSelected ? null : project.id)}
                                        className={`flex items-center p-2 cursor-pointer transition-colors rounded-lg mb-1 mx-1 ${isSelected ? 'bg-engineering-primary/10 border border-engineering-primary/30 shadow-sm' : 'hover:bg-engineering-border/20 border border-transparent'}`}
                                    >
                                        {isSelected ? <ChevronDown size={16} className="text-engineering-primary mr-2" /> : <ChevronRight size={16} className="text-gray-400 mr-2" />}
                                        <Folder size={16} className={`mr-2 ${isSelected ? 'text-engineering-primary' : 'text-gray-400'}`} />
                                        <span className={`text-sm font-medium flex-1 truncate ${isSelected ? 'text-white' : 'text-gray-400'}`}>{project.name}</span>
                                        {isSelected && !project.is_measurements_folder && (
                                            <div className="flex items-center gap-1">
                                                {onToggleAllLayers && projectAssets.length > 0 && (() => {
                                                    const allVisible = projectAssets.every(a => a.visible);
                                                    return (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onToggleAllLayers(project.id, !allVisible);
                                                            }}
                                                            className="p-1 text-carta-mist-600 hover:text-white transition"
                                                            title={allVisible ? "Hide All Layers" : "Show All Layers"}
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
                                                        className="p-1 text-carta-mist-600 hover:text-carta-forest-400 transition"
                                                        title="Share Project"
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
                                                        className="p-1 text-carta-mist-600 hover:text-engineering-primary transition"
                                                        title="Upload Files"
                                                    >
                                                        <Upload size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); requestDeleteProject(project.id, project.name); }}
                                                    className="p-1 text-carta-mist-600 hover:text-carta-accent-red transition"
                                                    title="Delete Project"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Assets List (Only if project selected) */}
                                    {isSelected && !project.is_measurements_folder && (
                                        <div className="pl-4 pr-1 py-1 space-y-1 ml-2 border-l border-white/10 my-1">
                                            {projectAssets.length === 0 && measurementsSubProjects.length === 0 && (
                                                <div className="text-[10px] text-carta-mist-600 italic py-1">Empty project. Upload files.</div>
                                            )}

                                            {/* Data Category */}
                                            {projectAssets.length > 0 && (
                                                <div>
                                                    <div
                                                        onClick={() => toggleCategory(project.id, 'data')}
                                                        className="flex items-center p-1.5 cursor-pointer hover:bg-[#57544F]/20 rounded transition-colors"
                                                    >
                                                        <ChevronRight
                                                            size={12}
                                                            className={`mr-1.5 text-gray-500 transition-transform ${isCategoryExpanded(project.id, 'data') ? 'rotate-90' : ''}`}
                                                        />
                                                        <Folder size={12} className="mr-1.5 text-gray-500" />
                                                        <span className="text-xs font-medium text-gray-400">Data</span>
                                                    </div>
                                                    {isCategoryExpanded(project.id, 'data') && (
                                                        <div className="pl-4 space-y-1 mt-1">
                                                            {/* KML Files */}
                                                            {projectAssets.filter(a => a.type === LayerType.KML).length > 0 && (
                                                                <div className="mb-1">
                                                                    <div className="text-[10px] text-carta-mist-500 font-medium mb-1 px-1">KML Files</div>
                                                                    {projectAssets.filter(a => a.type === LayerType.KML).map(asset =>
                                                                        renderAssetItem(asset, <FileBox size={14} />, 'text-[#EA580C]')
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
                                                                                {renderAssetItem(asset, <FileBox size={14} />, 'text-carta-forest-400')}

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
                                                                        renderAssetItem(asset, <FileBox size={14} />, 'text-[#EC4899]')
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Shapefiles */}
                                                            {projectAssets.filter(a => a.type === LayerType.SHP).length > 0 && (
                                                                <div className="mb-1">
                                                                    <div className="text-[10px] text-gray-500 font-medium mb-1 px-1">Shapefiles</div>
                                                                    {projectAssets.filter(a => a.type === LayerType.SHP).map(asset =>
                                                                        renderAssetItem(asset, <FileBox size={14} />, 'text-[#06B6D4]')
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* GLB/GLTF */}
                                                            {projectAssets.filter(a => a.type === LayerType.GLB_UNCOORD).length > 0 && (
                                                                <div className="mb-1">
                                                                    <div className="text-[10px] text-gray-500 font-medium mb-1 px-1">GLB/GLTF</div>
                                                                    {projectAssets.filter(a => a.type === LayerType.GLB_UNCOORD).map(asset =>
                                                                        renderAssetItem(asset, <Box size={14} />, 'text-[#A855F7]')
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Point Clouds (Potree & LAS) */}
                                                            {projectAssets.filter(a => a.type === LayerType.POTREE || a.type === LayerType.LAS).length > 0 && (
                                                                <div className="mb-1">
                                                                    <div className="text-[10px] text-gray-500 font-medium mb-1 px-1">Point Clouds</div>
                                                                    {projectAssets.filter(a => a.type === LayerType.POTREE || a.type === LayerType.LAS).map(asset =>
                                                                        renderAssetItem(asset, <Box size={14} />, 'text-[#0EA5E9]')
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Level 1 Measurements Category */}
                                            {measurementsSubProjects.length > 0 && (
                                                <div>
                                                    <div
                                                        onClick={() => toggleCategory(project.id, 'measurements')}
                                                        className="flex items-center p-1.5 cursor-pointer hover:bg-carta-deep-800/50 rounded transition-colors"
                                                    >
                                                        <ChevronRight
                                                            size={12}
                                                            className={`mr-1.5 text-carta-mist-500 transition-transform ${isCategoryExpanded(project.id, 'measurements') ? 'rotate-90' : ''}`}
                                                        />
                                                        <Folder size={12} className="mr-1.5 text-carta-mist-500" />
                                                        <span className="text-xs font-medium text-carta-mist-400">Measurements</span>
                                                    </div>
                                                    {isCategoryExpanded(project.id, 'measurements') && (
                                                        <div className="pl-4 space-y-1 mt-1">
                                                            {measurementsSubProjects.map(measurementProject => {
                                                                const measurementAssets = assets.filter(a => a.project_id === measurementProject.id);
                                                                return measurementAssets.map(measurement => (
                                                                    <div key={measurement.id} className="group flex items-center justify-between p-1.5 rounded hover:bg-carta-deep-800 transition">
                                                                        <div className="flex items-center overflow-hidden flex-1">
                                                                            <Map size={14} className="text-carta-gold-500 mr-2 flex-shrink-0" />
                                                                            {editingMeasurementId === measurement.id ? (
                                                                                <input
                                                                                    type="text"
                                                                                    value={editingName}
                                                                                    onChange={(e) => setEditingName(e.target.value)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') handleEditSave();
                                                                                        if (e.key === 'Escape') handleEditCancel();
                                                                                    }}
                                                                                    className="flex-1 bg-carta-deep-700 border border-carta-gold-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-carta-gold-500"
                                                                                    autoFocus
                                                                                />
                                                                            ) : (
                                                                                <span className="text-xs truncate max-w-[120px] text-carta-gold-300" title={measurement.name}>
                                                                                    {measurement.name}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                                                                            {editingMeasurementId === measurement.id ? (
                                                                                <>
                                                                                    <button onClick={handleEditSave} className="text-carta-mist-500 hover:text-green-400" title="Save">
                                                                                        <Check size={12} />
                                                                                    </button>
                                                                                    <button onClick={handleEditCancel} className="text-carta-mist-500 hover:text-red-400" title="Cancel">
                                                                                        <XIcon size={12} />
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <button onClick={() => onToggleLayer(measurement.id)} className="text-carta-mist-500 hover:text-white" title="Toggle Visibility">
                                                                                        {measurement.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                                                                    </button>
                                                                                    <button onClick={() => handleEditStart(measurement)} className="text-carta-mist-500 hover:text-carta-gold-400" title="Rename">
                                                                                        <Edit2 size={12} />
                                                                                    </button>
                                                                                    <button onClick={() => requestDeleteLayer(measurement.id, measurement.name)} className="text-carta-mist-500 hover:text-carta-accent-red" title="Delete">
                                                                                        <Trash2 size={12} />
                                                                                    </button>
                                                                                </>
                                                                            )}
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
