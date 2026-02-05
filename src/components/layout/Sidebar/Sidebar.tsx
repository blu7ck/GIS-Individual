import React, { useState } from 'react';
import {
    Folder,
    Eye,
    EyeOff,
    Trash2,
    Share2,
    ChevronDown,
    ChevronRight,
    Plus,
    Upload,
    Layers,
    Map as MapIcon,
    Loader2,
    AlertCircle,
    Maximize
} from 'lucide-react';
import { Project, AssetLayer, LayerType, AssetStatus } from '../../../../types';

interface SidebarProps {
    projects: Project[];
    assets: AssetLayer[];
    selectedProjectId: string | null;
    onSelectProject: (id: string) => void;
    onCreateProject: () => void;
    onDeleteProject: (id: string) => void;
    onShareProject: (project: Project) => void;

    onLayerClick: (id: string) => void;
    onToggleLayer: (id: string) => void;
    onDeleteLayer: (id: string) => void;
    onShareLayer: (layer: AssetLayer) => void;

    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onFolderUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
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
    onFolderUpload
}) => {
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'projects' | 'layers'>('projects');

    const toggleProject = (id: string) => {
        const newExpanded = new Set(expandedProjects);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedProjects(newExpanded);
        onSelectProject(id);
    };

    const selectedProjectAssets = assets.filter(a => a.project_id === selectedProjectId);

    return (
        <div className="h-full flex flex-col bg-engineering-panel border-r border-engineering-border text-engineering-text-primary w-80 font-sans text-sm">
            {/* Header */}
            <div className="h-12 flex items-center px-4 border-b border-engineering-border shrink-0">
                <h1 className="font-semibold text-engineering-text-primary tracking-tight">FIXURELABS <span className="text-engineering-primary font-normal text-xs uppercase ml-1">GEOSPATIAL</span></h1>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-engineering-border shrink-0">
                <button
                    onClick={() => setActiveTab('projects')}
                    className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${activeTab === 'projects' ? 'text-engineering-primary border-b-2 border-engineering-primary' : 'text-engineering-text-secondary hover:text-engineering-text-primary'}`}
                >
                    Projects
                </button>
                <button
                    onClick={() => setActiveTab('layers')}
                    className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${activeTab === 'layers' ? 'text-engineering-primary border-b-2 border-engineering-primary' : 'text-engineering-text-secondary hover:text-engineering-text-primary'}`}
                >
                    Layers
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto custom-scrollbar p-2">
                {activeTab === 'projects' && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between px-2 py-1 mb-2">
                            <span className="text-xs font-semibold text-engineering-text-muted uppercase">My Projects</span>
                            <button
                                onClick={onCreateProject}
                                className="p-1 hover:bg-engineering-bg rounded text-engineering-primary transition-colors"
                                title="New Project"
                            >
                                <Plus size={16} />
                            </button>
                        </div>

                        {projects.map(project => (
                            <div key={project.id} className="group">
                                <div
                                    className={`flex items-center px-2 py-1.5 rounded cursor-pointer transition-colors ${selectedProjectId === project.id ? 'bg-engineering-primary/10 text-engineering-primary' : 'hover:bg-engineering-bg text-engineering-text-secondary hover:text-engineering-text-primary'}`}
                                    onClick={() => toggleProject(project.id)}
                                >
                                    <span className="mr-2 opacity-70">
                                        {expandedProjects.has(project.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </span>
                                    <Folder size={14} className="mr-2 text-engineering-warning" />
                                    <span className="truncate flex-1 font-medium">{project.name}</span>

                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity ml-2 space-x-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onShareProject(project); }}
                                            className="p-1 hover:bg-engineering-panel rounded text-engineering-text-secondary hover:text-engineering-primary"
                                        >
                                            <Share2 size={12} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                                            className="p-1 hover:bg-engineering-panel rounded text-engineering-text-secondary hover:text-engineering-error"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>

                                {expandedProjects.has(project.id) && (
                                    <div className="ml-6 mt-1 space-y-0.5 border-l border-engineering-border pl-2">
                                        {assets.filter(a => a.project_id === project.id).map(asset => (
                                            <div
                                                key={asset.id}
                                                className="flex items-center px-2 py-1 round text-xs hover:bg-engineering-bg group/asset cursor-pointer"
                                                onClick={() => onLayerClick(asset.id)}
                                            >
                                                <span className="mr-2 opacity-70">
                                                    {asset.type === LayerType.TILES_3D ? <Layers size={12} /> : <MapIcon size={12} />}
                                                </span>
                                                <span className="truncate flex-1 text-engineering-text-secondary group-hover/asset:text-engineering-text-primary transition-colors">
                                                    {asset.name}
                                                </span>

                                                <div className="flex opacity-0 group-hover/asset:opacity-100 transition-opacity ml-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onToggleLayer(asset.id); }}
                                                        className="p-0.5 hover:text-engineering-primary mr-1"
                                                    >
                                                        {asset.visible ? <Eye size={12} /> : <EyeOff size={12} className="text-engineering-text-muted" />}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {assets.filter(a => a.project_id === project.id).length === 0 && (
                                            <div className="px-2 py-1 text-xs text-engineering-text-muted italic">No layers</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'layers' && (
                    <div className="space-y-4">
                        {/* Import Actions */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <label className="flex flex-col items-center justify-center p-3 border border-engineering-border border-dashed rounded cursor-pointer hover:bg-engineering-bg hover:border-engineering-primary transition-all group">
                                <Upload size={16} className="mb-1 text-engineering-text-secondary group-hover:text-engineering-primary" />
                                <span className="text-xs text-engineering-text-muted group-hover:text-engineering-text-primary">Import File</span>
                                <input type="file" onChange={onUpload} multiple className="hidden" accept=".geojson,.json,.kml,.kmz,.gpx,.zip,.dxf,.las,.laz" />
                            </label>
                            <label className="flex flex-col items-center justify-center p-3 border border-engineering-border border-dashed rounded cursor-pointer hover:bg-engineering-bg hover:border-engineering-primary transition-all group">
                                <Folder size={16} className="mb-1 text-engineering-text-secondary group-hover:text-engineering-primary" />
                                <span className="text-xs text-engineering-text-muted group-hover:text-engineering-text-primary">Import Folder</span>
                                <input
                                    type="file"
                                    onChange={onFolderUpload}
                                    // @ts-ignore - webkitdirectory is standard in modern browsers
                                    webkitdirectory=""
                                    directory=""
                                    className="hidden"
                                />
                            </label>
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs font-semibold text-engineering-text-muted uppercase px-2 mb-2">Active Layers</div>
                            {selectedProjectId ? selectedProjectAssets.map(asset => (
                                <div
                                    key={asset.id}
                                    className="flex items-center justify-between px-3 py-2 bg-engineering-bg/40 rounded border border-transparent hover:border-engineering-border group transition-all"
                                >
                                    <div className="flex items-center overflow-hidden" onClick={() => onLayerClick(asset.id)}>
                                        <span className={`mr-2 flex-shrink-0 ${asset.visible ? 'text-engineering-primary' : 'text-engineering-text-muted'}`}>
                                            {asset.type === LayerType.TILES_3D ? <Layers size={14} /> : <MapIcon size={14} />}
                                        </span>
                                        <span className="truncate text-sm text-engineering-text-primary">{asset.name}</span>
                                    </div>

                                    <div className="flex items-center space-x-1">
                                        {/* Status Indicators */}
                                        {asset.status === AssetStatus.PROCESSING && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-engineering-warning/10 rounded-full mr-1">
                                                <Loader2 size={10} className="animate-spin text-engineering-warning" />
                                                <span className="text-[10px] text-engineering-warning font-medium uppercase tracking-tighter">Processing</span>
                                            </div>
                                        )}
                                        {asset.status === AssetStatus.ERROR && (
                                            <span title="Processing Failed">
                                                <AlertCircle size={14} className="text-engineering-error mr-1" />
                                            </span>
                                        )}

                                        {/* Potree Switch Button (Only for 3D Tiles/Point Clouds) */}
                                        {(asset.type === LayerType.TILES_3D || asset.type === LayerType.POTREE) && asset.status !== AssetStatus.PROCESSING && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onLayerClick(asset.id); }}
                                                className="p-1.5 rounded hover:bg-purple-500/20 text-purple-400"
                                                title="Open in Potree Analyzer"
                                            >
                                                <Maximize size={14} />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => onToggleLayer(asset.id)}
                                            className={`p-1.5 rounded hover:bg-engineering-panel ${asset.visible ? 'text-engineering-primary' : 'text-engineering-text-muted'}`}
                                            title="Toggle Visibility"
                                        >
                                            {asset.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                                        </button>
                                        <button
                                            onClick={() => onShareLayer(asset)}
                                            className="p-1.5 rounded hover:bg-engineering-panel text-engineering-text-secondary hover:text-engineering-primary"
                                            title="Share Layer"
                                        >
                                            <Share2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => onDeleteLayer(asset.id)}
                                            className="p-1.5 rounded hover:bg-engineering-panel text-engineering-text-secondary hover:text-engineering-error"
                                            title="Delete Layer"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-8 text-engineering-text-muted text-xs">
                                    Select a project to view layers
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-engineering-border bg-engineering-bg/30">
                <div className="text-xs text-engineering-text-muted">
                    <div className="flex justify-between">
                        <span>Version</span>
                        <span>0.9.5 (Beta)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
