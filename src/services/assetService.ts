/**
 * Asset Service - CRUD operations for assets
 */
import { v4 as uuidv4 } from 'uuid';
import { AssetLayer, StorageConfig, LayerType, AssetStatus } from '../types';
import { createSupabaseClient } from '../lib/supabase';
import { uploadToR2, uploadFolderToR2, deleteFromR2 } from './storage';
import { logger } from '../utils/logger';
import { dxfToGeoJSON } from '../utils/dxfToGeoJSON';
import { shpToGeoJSON } from '../utils/shpToGeoJSON';

export interface AssetServiceResult<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface UploadOptions {
    noTransform?: boolean;
    referencePoint?: { lng: number; lat: number };
    autoCenter?: boolean;
}

export interface UploadProgress {
    percent: number;
    message: string;
}

/**
 * Upload a single file as asset
 */
export async function uploadFileAsset(
    file: File,
    type: LayerType,
    projectId: string,
    config: StorageConfig | null,
    options?: UploadOptions,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
): Promise<AssetServiceResult<AssetLayer>> {
    let finalUrl = '';
    let geoJSONData: unknown = null;

    try {
        if (signal?.aborted) throw new Error('Upload cancelled');

        // Convert DXF to GeoJSON
        if (type === LayerType.DXF) {
            onProgress?.({ percent: 0, message: 'Converting DXF to GeoJSON...' });
            const arrayBuffer = await file.arrayBuffer();

            if (signal?.aborted) throw new Error('Upload cancelled');

            const dxfOptions: Record<string, unknown> = {};
            if (options?.noTransform) {
                dxfOptions.noTransform = true;
                dxfOptions.autoCenter = false;
            } else if (options?.referencePoint) {
                dxfOptions.referencePoint = options.referencePoint;
                dxfOptions.autoCenter = false;
            } else {
                dxfOptions.autoCenter = true;
            }

            geoJSONData = await dxfToGeoJSON(arrayBuffer, dxfOptions);
            const geoJSONBlob = new Blob([JSON.stringify(geoJSONData)], { type: 'application/json' });
            const geoJSONFile = new File(
                [geoJSONBlob],
                file.name.replace('.dxf', '.geojson'),
                { type: 'application/json' }
            );

            if (config) {
                finalUrl = await uploadToR2(geoJSONFile, config, (progress) => {
                    onProgress?.({ percent: progress, message: `${Math.round(progress)}%` });
                }, signal);
            } else {
                finalUrl = URL.createObjectURL(geoJSONFile);
            }
        }
        // Convert SHP to GeoJSON
        else if (type === LayerType.SHP) {
            onProgress?.({ percent: 0, message: 'Converting Shapefile to GeoJSON...' });

            // Check signal before expensive op
            if (signal?.aborted) throw new Error('Upload cancelled');

            geoJSONData = await shpToGeoJSON(file);
            const geoJSONBlob = new Blob([JSON.stringify(geoJSONData)], { type: 'application/json' });
            const geoJSONFile = new File(
                [geoJSONBlob],
                file.name.replace('.zip', '.geojson'),
                { type: 'application/json' }
            );

            if (config) {
                finalUrl = await uploadToR2(geoJSONFile, config, (progress) => {
                    onProgress?.({ percent: progress, message: `${Math.round(progress)}%` });
                }, signal);
            } else {
                finalUrl = URL.createObjectURL(geoJSONFile);
            }
        }
        // Potree/Point Cloud - Mark as processing if raw LAS/LAZ
        else if (type === LayerType.POTREE || type === LayerType.LAS) {
            if (config) {
                finalUrl = await uploadToR2(file, config, (progress) => {
                    const label = type === LayerType.LAS ? 'LAS/LAZ' : 'Point Cloud';
                    onProgress?.({ percent: progress, message: `Uploading ${label}: ${Math.round(progress)}%` });
                }, signal);
            } else {
                finalUrl = URL.createObjectURL(file);
            }
        }
        // Regular file upload
        else {
            if (config) {
                finalUrl = await uploadToR2(file, config, (progress) => {
                    onProgress?.({ percent: progress, message: `${Math.round(progress)}%` });
                }, signal);
            } else {
                finalUrl = URL.createObjectURL(file);
            }
        }

        if (signal?.aborted) throw new Error('Upload cancelled');

        const isPointCloud = type === LayerType.POTREE || type === LayerType.LAS;

        const newAsset: AssetLayer = {
            id: uuidv4(),
            project_id: projectId,
            name: file.name,
            type,
            storage_path: finalUrl,
            url: finalUrl,
            visible: false,
            opacity: 1,
            data: geoJSONData || undefined,
            status: isPointCloud ? AssetStatus.PROCESSING : AssetStatus.READY
        };

        // Save to Supabase
        if (config?.supabaseUrl && config?.supabaseKey) {
            const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);
            const { error } = await supabase.from('assets').insert({
                id: newAsset.id,
                project_id: newAsset.project_id,
                name: newAsset.name,
                type: newAsset.type,
                storage_path: newAsset.storage_path,
                position: null,
                data: newAsset.data || null,
                status: newAsset.status || AssetStatus.READY
            });

            if (error) {
                logger.error('Error saving asset to Supabase:', error);
                // Cleanup R2
                await cleanupR2OnError(finalUrl, type, config);
                return { success: false, error: 'Failed to save asset to database' };
            }

            // Trigger point cloud processing for LAS/LAZ files
            const isPointCloudType = type === LayerType.POTREE || type === LayerType.LAS;
            if (isPointCloudType && config.workerUrl) {
                // Trigger cloud processing
                fetch(`${config.workerUrl}/process-pointcloud`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        assetId: newAsset.id,
                        rawFileUrl: finalUrl,
                        projectId: projectId
                    })
                }).catch(err => logger.error('Error triggering point cloud processing:', err));
            }
        }

        return { success: true, data: newAsset };
    } catch (e) {
        if (e instanceof Error && e.message === 'Upload cancelled') {
            // Cleanup if URL was generated but process aborted (if needed)
            return { success: false, error: 'Upload cancelled' };
        }
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Error uploading asset:', e);
        return { success: false, error: errorMessage };
    }
}

/**
 * Upload a folder (3D Tiles or Potree) as asset
 */
export async function uploadFolderAsset(
    files: FileList,
    type: LayerType,
    projectId: string,
    config: StorageConfig,
    onProgress?: (current: number, total: number) => void,
    signal?: AbortSignal
): Promise<AssetServiceResult<AssetLayer>> {
    try {
        if (signal?.aborted) throw new Error('Upload cancelled');

        // Only allow 3D Tiles and Potree for folder uploads
        if (type !== LayerType.TILES_3D && type !== LayerType.POTREE) {
            return { success: false, error: 'Invalid folder upload type' };
        }

        const finalUrl = await uploadFolderToR2(files, type, config, onProgress, signal);

        // Extract folder name safely
        let folderName = type === LayerType.POTREE ? 'Point Cloud' : '3D Tileset';
        const firstFile = files[0];
        if (firstFile && 'webkitRelativePath' in firstFile) {
            const relativePath = (firstFile as File & { webkitRelativePath: string }).webkitRelativePath;
            if (relativePath) {
                const rootPart = relativePath.split('/')[0];
                if (rootPart) {
                    folderName = rootPart.replace(/[^a-zA-Z0-9._-]/g, '_') || folderName;
                }
            }
        }

        const newAsset: AssetLayer = {
            id: uuidv4(),
            project_id: projectId,
            name: folderName,
            type: type,
            storage_path: finalUrl,
            url: finalUrl,
            visible: false,
            opacity: 1,
            status: type === LayerType.POTREE ? AssetStatus.READY : AssetStatus.READY
        };

        // Save to Supabase
        if (config.supabaseUrl && config.supabaseKey) {
            const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);
            const { error } = await supabase.from('assets').insert({
                id: newAsset.id,
                project_id: newAsset.project_id,
                name: newAsset.name,
                type: newAsset.type,
                storage_path: newAsset.storage_path,
                position: null,
            });

            if (error) {
                logger.error('Error saving folder asset to Supabase:', error);
                await cleanupR2OnError(finalUrl, LayerType.TILES_3D, config);
                return { success: false, error: 'Failed to save to database' };
            }
        }

        return { success: true, data: newAsset };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Error uploading folder:', e);
        return { success: false, error: errorMessage };
    }
}

/**
 * Helper to get folder prefix from a file URL
 */
function getFolderPrefix(url: string): string {
    const parts = url.split('/');
    parts.pop(); // Remove filename
    return parts.join('/') + '/';
}

/**
 * Delete an asset
 */
export async function deleteAsset(
    asset: AssetLayer,
    config: StorageConfig | null
): Promise<AssetServiceResult> {
    if (config?.supabaseUrl && config?.supabaseKey) {
        try {
            // 1. Delete original storage path from R2
            if (asset.storage_path?.startsWith('http') && config.workerUrl) {
                const isFolder = asset.type === LayerType.TILES_3D || asset.type === LayerType.POTREE;
                const pathToDelete = isFolder ? getFolderPrefix(asset.storage_path) : asset.storage_path;

                try {
                    await deleteFromR2(pathToDelete, config, isFolder);
                } catch (e) {
                    logger.warn('Failed to delete original R2 file/folder:', e);
                }
            }

            // 2. Delete processed outputs from R2 if they exist
            if (config?.workerUrl) {
                if (asset.potree_url?.startsWith('http')) {
                    try {
                        await deleteFromR2(getFolderPrefix(asset.potree_url), config, true);
                    } catch (e) {
                        logger.warn('Failed to delete processed potree output:', e);
                    }
                }
                if (asset.tiles_url?.startsWith('http')) {
                    try {
                        await deleteFromR2(getFolderPrefix(asset.tiles_url), config, true);
                    } catch (e) {
                        logger.warn('Failed to delete processed tiles output:', e);
                    }
                }
            }

            // 3. Delete from Supabase
            const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);
            const { error } = await supabase.from('assets').delete().eq('id', asset.id);

            if (error) {
                logger.error('Error deleting asset from Supabase:', error);
                return { success: false, error: 'Failed to delete from database' };
            }
        } catch (e) {
            logger.error('Error deleting asset:', e);
            return { success: false, error: 'Failed to delete asset' };
        }
    }

    return { success: true };
}

/**
 * Update asset metadata (heightOffset, scale, etc.) and location
 */
export async function updateAssetMetadata(
    assetId: string,
    updates: { heightOffset?: number; scale?: number; offsetX?: number; offsetY?: number; rotation?: number; position?: { lat: number; lng: number; height: number } },
    config: StorageConfig | null
): Promise<AssetServiceResult> {
    if (config?.supabaseUrl && config?.supabaseKey) {
        try {
            const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);

            // First fetch current metadata to merge
            const { data: current, error: fetchError } = await supabase
                .from('assets')
                .select('metadata, position')
                .eq('id', assetId)
                .single();

            if (fetchError) throw fetchError;

            // Separate metadata fields from top-level column fields
            const { position, ...metadataUpdates } = updates;

            const newMetadata = {
                ...(current?.metadata || {}),
                ...metadataUpdates
            };

            const dbUpdate: any = { metadata: newMetadata };
            if (position !== undefined) {
                dbUpdate.position = position;
            }

            const { error } = await supabase
                .from('assets')
                .update(dbUpdate)
                .eq('id', assetId);

            if (error) {
                logger.error('Error updating asset metadata:', error);
                return { success: false, error: 'Failed to update asset metadata' };
            }
        } catch (e) {
            logger.error('Error connecting to Supabase:', e);
            return { success: false, error: 'Failed to connect to database' };
        }
    }

    return { success: true };
}

/**
 * Rename an asset
 */
export async function renameAsset(
    assetId: string,
    newName: string,
    config: StorageConfig | null
): Promise<AssetServiceResult> {
    if (config?.supabaseUrl && config?.supabaseKey) {
        try {
            const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);
            const { error } = await supabase
                .from('assets')
                .update({ name: newName })
                .eq('id', assetId);

            if (error) {
                logger.error('Error renaming asset:', error);
                return { success: false, error: 'Failed to rename asset' };
            }
        } catch (e) {
            logger.error('Error connecting to Supabase:', e);
            return { success: false, error: 'Failed to connect to database' };
        }
    }

    return { success: true };
}

/**
 * Fetch all assets for a user
 */
export async function fetchAssets(
    userId: string,
    config: StorageConfig
): Promise<AssetServiceResult<AssetLayer[]>> {
    try {
        if (!config.supabaseUrl || !config.supabaseKey) {
            throw new Error('Supabase configuration is required for fetching assets');
        }

        const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);
        const { data, error } = await supabase
            .from('assets')
            .select(`
        *,
        projects!assets_project_id_fkey!inner(owner_id)
      `)
            .eq('projects.owner_id', userId);

        if (error) {
            logger.error('Error fetching assets:', error);
            return { success: false, error: 'Failed to fetch assets' };
        }

        // Map to AssetLayer format
        const assets: AssetLayer[] = (data || []).map((row: Record<string, any>) => {
            const rawMetadata = row.metadata || {};
            return {
                id: row.id as string,
                project_id: row.project_id as string,
                name: row.name as string,
                type: row.type as LayerType,
                storage_path: row.storage_path as string,
                url: row.storage_path as string,
                visible: false,
                opacity: 1,
                position: row.position as { lat: number; lng: number; height: number } | undefined,
                data: row.data,
                status: row.status as AssetStatus || AssetStatus.READY,
                potree_url: row.potree_url as string | undefined,
                tiles_url: row.tiles_url as string | undefined,
                error_message: row.error_message as string | undefined,
                heightOffset: rawMetadata.heightOffset,
                offsetX: rawMetadata.offsetX,
                offsetY: rawMetadata.offsetY,
                rotation: rawMetadata.rotation,
                scale: rawMetadata.scale,
                metadata: rawMetadata
            };
        });

        return { success: true, data: assets };
    } catch (e) {
        logger.error('Error connecting to Supabase:', e);
        return { success: false, error: 'Failed to connect to database' };
    }
}

/**
 * Add an asset from a URL (without uploading to R2)
 */
export async function addUrlAsset(
    url: string,
    type: LayerType,
    name: string,
    projectId: string,
    config: StorageConfig | null
): Promise<AssetServiceResult<AssetLayer>> {
    try {
        const newAsset: AssetLayer = {
            id: uuidv4(),
            project_id: projectId,
            name: name || 'URL Asset',
            type,
            storage_path: url,
            url: url,
            visible: false,
            opacity: 1,
        };

        // Save to Supabase
        if (config?.supabaseUrl && config?.supabaseKey) {
            const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);
            const { error } = await supabase.from('assets').insert({
                id: newAsset.id,
                project_id: newAsset.project_id,
                name: newAsset.name,
                type: newAsset.type,
                storage_path: newAsset.storage_path,
                position: null,
            });

            if (error) {
                logger.error('Error saving URL asset to Supabase:', error);
                return { success: false, error: 'Failed to save asset to database' };
            }
        }

        return { success: true, data: newAsset };
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        logger.error('Error adding URL asset:', e);
        return { success: false, error: errorMessage };
    }
}

/**
 * Helper to cleanup R2 on error
 */
async function cleanupR2OnError(
    url: string,
    type: LayerType,
    config: StorageConfig
): Promise<void> {
    if (url.startsWith('http') && config.workerUrl) {
        try {
            const isFolder = type === LayerType.TILES_3D || type === LayerType.POTREE;
            const pathToDelete = isFolder ? getFolderPrefix(url) : url;
            await deleteFromR2(pathToDelete, config, isFolder);
        } catch (cleanupError) {
            logger.warn('Failed to cleanup R2 file:', cleanupError);
        }
    }
}
