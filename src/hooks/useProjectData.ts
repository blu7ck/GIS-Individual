import { useState, useEffect } from 'react';
import { Project, AssetLayer, StorageConfig } from '../types';
import { createProject, deleteProject, fetchProjects } from '../services/projectService';
import { fetchAssets, updateAssetMetadata } from '../services/assetService';


interface User {
    id: string;
    email: string;
}

export function useProjectData(user: User | null, storageConfig: StorageConfig | null, notify: (msg: string, type: any) => void, refreshKey: number = 0) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [assets, setAssets] = useState<AssetLayer[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    // Load data when user logs in
    useEffect(() => {
        if (!storageConfig?.supabaseUrl || !storageConfig?.supabaseKey || !user) return;

        const loadData = async () => {
            try {
                // Load projects
                const projectsResult = await fetchProjects(user.id, storageConfig);
                if (projectsResult.success && projectsResult.data) {
                    setProjects(projectsResult.data);
                } else if (projectsResult.error) {
                    console.error('Error loading projects:', projectsResult.error);
                }

                // Load assets
                const assetsResult = await fetchAssets(user.id, storageConfig);
                if (assetsResult.success && assetsResult.data) {
                    setAssets(assetsResult.data);
                } else if (assetsResult.error) {
                    console.error('Error loading assets:', assetsResult.error);
                }
            } catch (e: any) {
                console.error('Error loading data:', e);
            }
        };

        loadData();
    }, [storageConfig, user, refreshKey]);

    const handleCreateProject = async (name: string) => {
        if (!user) return;
        console.log('[useProjectData] Creating project with name:', name);

        const result = await createProject(name, user.id, storageConfig);
        if (result.success && result.data) {
            setProjects((prev) => [...prev, result.data!]);
            setSelectedProjectId(result.data.id);
            notify(`Project "${name}" created`, 'success');
        } else {
            notify(result.error || 'Failed to create project', 'error');
        }
    };

    const handleDeleteProject = async (id: string) => {
        if (!window.confirm("Are you sure? All assets in this project will be deleted permanently.")) return;

        const projectAssets = assets.filter((a) => a.project_id === id);
        const result = await deleteProject(id, projectAssets, storageConfig);

        if (result.success) {
            setProjects((prev) => prev.filter((p) => p.id !== id));
            setAssets((prev) => prev.filter((a) => a.project_id !== id));
            if (selectedProjectId === id) setSelectedProjectId(null);
            notify('Project deleted', 'success');
        } else {
            notify(result.error || 'Failed to delete project', 'error');
        }
    };

    const handleUpdateAssetMetadata = async (assetId: string, metadata: { heightOffset?: number; scale?: number }) => {
        const result = await updateAssetMetadata(assetId, metadata, storageConfig);
        if (result.success) {
            setAssets(prev => prev.map(a => a.id === assetId ? { ...a, ...metadata } : a));
            notify('Asset properties updated', 'success');
        } else {
            notify(result.error || 'Failed to update asset', 'error');
        }
    };

    return {
        projects,
        setProjects,
        assets,
        setAssets,
        selectedProjectId,
        setSelectedProjectId,
        handleCreateProject,
        handleDeleteProject,
        handleUpdateAssetMetadata
    };
}
