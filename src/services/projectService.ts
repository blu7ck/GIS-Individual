/**
 * Project Service - CRUD operations for projects
 */
import { v4 as uuidv4 } from 'uuid';
import { Project, StorageConfig, AssetLayer, LayerType } from '../types';
import { createSupabaseClient } from '../lib/supabase';
import { deleteFromR2, reliableDeleteFromR2 } from './storage';
import { logger } from '../utils/logger';

export interface ProjectServiceResult<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Create a new project
 */
export async function createProject(
    name: string,
    userId: string,
    config: StorageConfig | null
): Promise<ProjectServiceResult<Project>> {
    const newProject: Project = {
        id: uuidv4(),
        name,
        owner_id: userId,
        created_at: new Date().toISOString(),
    };

    if (config?.supabaseUrl && config?.supabaseKey) {
        try {
            const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);
            const { error } = await supabase.from('projects').insert({
                id: newProject.id,
                name: newProject.name,
                owner_id: newProject.owner_id,
                created_at: newProject.created_at,
            });

            if (error) {
                logger.error('Error saving project to Supabase:', error);
                return { success: false, error: 'Failed to save project to database' };
            }
        } catch (e) {
            logger.error('Error connecting to Supabase:', e);
            return { success: false, error: 'Failed to connect to database' };
        }
    }

    return { success: true, data: newProject };
}

/**
 * Delete a project and all its assets
 */
export async function deleteProject(
    projectId: string,
    projectAssets: AssetLayer[],
    config: StorageConfig | null
): Promise<ProjectServiceResult> {
    if (config?.supabaseUrl && config?.supabaseKey) {
        try {
            const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);

            // Delete assets from R2 first
            for (const asset of projectAssets) {
                if (asset.storage_path?.startsWith('http') && config.workerUrl) {
                    try {
                        const isFolder = asset.type === LayerType.TILES_3D;
                        if (isFolder) {
                            logger.debug('[deleteProject] Reliable delete for 3D Tiles:', asset.name);
                            await reliableDeleteFromR2(asset.storage_path, config, true);
                        } else {
                            await deleteFromR2(asset.storage_path, config, false);
                        }
                    } catch (e) {
                        logger.warn('Failed to delete asset from R2:', asset.name, e);
                    }
                }

                // Delete from Supabase
                const { error } = await supabase.from('assets').delete().eq('id', asset.id);
                if (error) {
                    logger.error('Error deleting asset from Supabase:', error);
                }
            }

            // Delete project from Supabase
            const { error } = await supabase.from('projects').delete().eq('id', projectId);
            if (error) {
                logger.error('Error deleting project from Supabase:', error);
                return { success: false, error: 'Failed to delete project from database' };
            }
        } catch (e) {
            logger.error('Error deleting project:', e);
            return { success: false, error: 'Failed to delete project' };
        }
    }

    return { success: true };
}

/**
 * Rename a project
 */
export async function renameProject(
    projectId: string,
    newName: string,
    config: StorageConfig | null
): Promise<ProjectServiceResult> {
    if (config?.supabaseUrl && config?.supabaseKey) {
        try {
            const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);
            const { error } = await supabase
                .from('projects')
                .update({ name: newName })
                .eq('id', projectId);

            if (error) {
                logger.error('Error renaming project:', error);
                return { success: false, error: 'Failed to rename project' };
            }
        } catch (e) {
            logger.error('Error connecting to Supabase:', e);
            return { success: false, error: 'Failed to connect to database' };
        }
    }

    return { success: true };
}

/**
 * Fetch all projects for a user
 */
export async function fetchProjects(
    userId: string,
    config: StorageConfig
): Promise<ProjectServiceResult<Project[]>> {
    try {
        const supabase = createSupabaseClient(config.supabaseUrl ?? '', config.supabaseKey ?? '');
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('owner_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Error fetching projects:', error);
            return { success: false, error: 'Failed to fetch projects' };
        }

        return { success: true, data: data || [] };
    } catch (e) {
        logger.error('Error connecting to Supabase:', e);
        return { success: false, error: 'Failed to connect to database' };
    }
}
