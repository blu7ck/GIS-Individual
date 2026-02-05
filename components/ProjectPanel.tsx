/**
 * ProjectPanel - Optimized for Performance
 * - O(1) lookups for assets and sub-projects
 * - Memoized derived state
 * - Stable callbacks
 */
import React, { useEffect, useMemo, useCallback } from 'react';
import { Folder, ChevronRight, ChevronDown, Eye, EyeOff, Share2, Map as MapIcon, Trash2, FileBox } from 'lucide-react';
import { Project, AssetLayer, LayerType, StorageConfig } from '../types';
import { Button } from './Button';
import { StorageBar } from './StorageBar';
import { AssetItem, useProjectPanel, getLayerTypeStyle } from './ProjectPanel/index';

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
  onShareLayer: (asset: AssetLayer) => void;
  onShareProject?: (project: Project) => void;
  onLayerClick?: (layerId: string) => void;
  onOpenModelViewer?: (layer: AssetLayer) => void;
  onUpdateMeasurement?: (id: string, newName: string) => void;
  onUpdateAsset?: (id: string, newName: string, updates?: { heightOffset?: number; scale?: number }) => void;
  externalCreateTrigger?: number;
  storageConfig?: StorageConfig | null;
}

// Layer type groups for rendering
const DATA_LAYER_TYPES = [LayerType.KML, LayerType.TILES_3D, LayerType.DXF, LayerType.SHP, LayerType.GLB_UNCOORD] as const;

export const ProjectPanel: React.FC<Props> = React.memo(({
  projects,
  assets,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onToggleLayer,
  onToggleAllLayers,
  onDeleteLayer,
  onShareLayer,
  onShareProject,
  onLayerClick,
  onOpenModelViewer,
  onUpdateMeasurement,
  onUpdateAsset,
  externalCreateTrigger,
  storageConfig
}) => {
  const {
    editingId,
    editingName,
    startEdit,
    cancelEdit,
    setEditingName,
    isCreating,
    setIsCreating,
    newProjectName,
    setNewProjectName,
    toggleCategory,
    isCategoryExpanded,
    initializeCategories,
  } = useProjectPanel();

  // 1. Memoized Groupings (O(N) -> O(1) lookup)
  const assetsByProjectId = useMemo(() => {
    const map = new Map<string, AssetLayer[]>();
    assets.forEach(asset => {
      if (!asset.project_id) return;
      const list = map.get(asset.project_id) || [];
      list.push(asset);
      map.set(asset.project_id, list);
    });
    return map;
  }, [assets]);

  const projectsByParentId = useMemo(() => {
    const map = new Map<string, Project[]>();
    projects.forEach(project => {
      const parentId = project.parent_project_id || 'root';
      const list = map.get(parentId) || [];
      list.push(project);
      map.set(parentId, list);
    });
    return map;
  }, [projects]);

  const rootProjects = useMemo(() => projectsByParentId.get('root') || [], [projectsByParentId]);

  // 2. Stable Dependencies for Initialization
  const rootProjectIds = useMemo(() => rootProjects.map(p => p.id), [rootProjects]);

  useEffect(() => {
    initializeCategories(rootProjectIds);
  }, [rootProjectIds, initializeCategories]);

  // Handle external create trigger
  useEffect(() => {
    if (externalCreateTrigger && externalCreateTrigger > 0) {
      setIsCreating(true);
    }
  }, [externalCreateTrigger, setIsCreating]);

  // 3. Stable Handlers
  const handleEditSave = useCallback(() => {
    if (!editingId || !editingName.trim()) return;
    const targetLayer = assets.find(a => a.id === editingId);
    if (!targetLayer) return;

    if (targetLayer.type === LayerType.ANNOTATION && onUpdateMeasurement) {
      onUpdateMeasurement(editingId, editingName.trim());
    } else if (onUpdateAsset) {
      onUpdateAsset(editingId, editingName.trim());
    }
    cancelEdit();
  }, [editingId, editingName, assets, onUpdateMeasurement, onUpdateAsset, cancelEdit]);

  const handleCreate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName) {
      onCreateProject(newProjectName);
      setNewProjectName('');
      setIsCreating(false);
    }
  }, [newProjectName, onCreateProject, setNewProjectName, setIsCreating]);

  // Helper to render asset groups (avoids inline function recreation if passed carefully)
  const renderAssetGroup = (projectAssets: AssetLayer[], type: LayerType) => {
    // Note: We intentionally don't memoize this *result* heavily because filteredAssets changes often.
    // But the lookup `assetsByProjectId` helps avoid filtering *all* assets.
    const filteredAssets = projectAssets.filter(a => a.type === type);
    if (filteredAssets.length === 0) return null;

    const { label } = getLayerTypeStyle(type);

    return (
      <div key={type} className="mb-1">
        <div className="text-[10px] text-carta-mist-500 font-medium mb-1 px-1">{label}</div>
        {filteredAssets.map(asset => (
          <AssetItem
            key={asset.id}
            asset={asset}
            isEditing={editingId === asset.id}
            editingName={editingName}
            onLayerClick={onLayerClick}
            onToggle={onToggleLayer}
            onShare={onShareLayer}
            onDelete={onDeleteLayer}
            onEditStart={startEdit}
            onEditChange={setEditingName}
            onEditSave={handleEditSave}
            onEditCancel={cancelEdit}
            onOpenModelViewer={onOpenModelViewer}
            showEditButton={type === LayerType.TILES_3D}
            showShareButton={type !== LayerType.GLB_UNCOORD}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-white">
      {/* New Project Form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="p-3 border-b border-[#57544F] bg-[#1C1B19]/50 animate-in slide-in-from-top-2">
          <input
            autoFocus
            type="text"
            placeholder="Project Name..."
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            className="w-full bg-[#1C1B19] border border-[#57544F] rounded p-2 text-sm text-white mb-2 focus:border-[#12B285] outline-none"
          />
          <div className="flex justify-end space-x-2">
            <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)} type="button">Cancel</Button>
            <Button size="sm" type="submit" className="bg-[#12B285] hover:bg-[#12B285]/80 text-white border-none">Create</Button>
          </div>
        </form>
      )}

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {rootProjects.length === 0 && !isCreating && (
          <div className="text-center text-carta-mist-500 text-xs mt-10">
            No projects yet.<br />Create one to start uploading.
          </div>
        )}

        {rootProjects.map(project => {
          const isSelected = selectedProjectId === project.id;
          // O(1) Lookup
          const projectAssets = assetsByProjectId.get(project.id)?.filter(a => a.type !== LayerType.ANNOTATION) || [];

          // Sub-projects (measurements) O(1) Lookup + filter
          const subProjects = projectsByParentId.get(project.id) || [];
          const measurementsSubProjects = subProjects.filter(p => p.is_measurements_folder && !p.linked_asset_id);

          return (
            <div key={project.id} className="rounded-lg overflow-hidden border border-transparent transition-all">
              {/* Project Header */}
              <div
                onClick={() => !project.is_measurements_folder && onSelectProject(isSelected ? null : project.id)}
                className={`flex items-center p-2 cursor-pointer transition-colors rounded-lg mb-1 mx-1 ${isSelected ? 'bg-[#12B285]/10 border border-[#12B285]/30 shadow-sm' : 'hover:bg-[#57544F]/20 border border-transparent'}`}
              >
                {isSelected ? <ChevronDown size={16} className="text-[#12B285] mr-2" /> : <ChevronRight size={16} className="text-gray-400 mr-2" />}
                <Folder size={16} className={`mr-2 ${isSelected ? 'text-[#12B285]' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium flex-1 truncate ${isSelected ? 'text-white' : 'text-gray-400'}`}>{project.name}</span>
                {isSelected && !project.is_measurements_folder && (
                  <div className="flex items-center gap-1">
                    {onToggleAllLayers && projectAssets.length > 0 && (() => {
                      const allVisible = projectAssets.every(a => a.visible);
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleAllLayers(project.id, !allVisible); }}
                          className="p-1 text-carta-mist-600 hover:text-white transition"
                          title={allVisible ? "Hide All Layers" : "Show All Layers"}
                        >
                          {allVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      );
                    })()}
                    {onShareProject && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onShareProject(project); }}
                        className="p-1 text-carta-mist-600 hover:text-carta-forest-400 transition"
                        title="Share Project"
                      >
                        <Share2 size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
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

                  {/* Data Category - Collapsible */}
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
                          {DATA_LAYER_TYPES.map(type => renderAssetGroup(projectAssets, type))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Measurements Category - Collapsible */}
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
                            // O(1) lookup
                            const measurementAssets = assetsByProjectId.get(measurementProject.id) || [];

                            return measurementAssets.map(measurement => (
                              <div key={measurement.id} className="group flex items-center justify-between p-1.5 rounded hover:bg-carta-deep-800 transition">
                                <div className="flex items-center overflow-hidden flex-1">
                                  <MapIcon size={14} className="text-carta-gold-500 mr-2 flex-shrink-0" />
                                  {editingId === measurement.id ? (
                                    <input
                                      type="text"
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleEditSave();
                                        if (e.key === 'Escape') cancelEdit();
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
                                  <button onClick={() => onToggleLayer(measurement.id)} className="text-carta-mist-500 hover:text-white" title="Toggle Visibility">
                                    {measurement.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                  </button>
                                  <button onClick={() => startEdit(measurement)} className="text-carta-mist-500 hover:text-carta-gold-400" title="Edit Name">
                                    <FileBox size={12} />
                                  </button>
                                  <button onClick={() => onDeleteLayer(measurement.id)} className="text-carta-mist-500 hover:text-carta-accent-red" title="Delete">
                                    <Trash2 size={12} />
                                  </button>
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

      {/* Storage Usage Footer */}
      <StorageBar storageConfig={storageConfig || null} maxStorageGB={10} />
    </div>
  );
});

ProjectPanel.displayName = 'ProjectPanel';