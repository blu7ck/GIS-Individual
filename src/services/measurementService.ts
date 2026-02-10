
import { v4 as uuidv4 } from 'uuid';
import { AssetLayer, LayerType, StorageConfig, AssetStatus } from '../types';
import { createSupabaseClient } from '../lib/supabase';
import { logger } from '../utils/logger';

export async function saveMeasurementAsAnnotation(
    projectId: string,
    userId: string,
    name: string,
    text: string,
    geometry: any,
    mode: string,
    config: StorageConfig | null
): Promise<{ success: boolean; data?: AssetLayer; error?: string }> {
    if (!config?.supabaseUrl || !config?.supabaseKey) {
        return { success: false, error: 'Supabase configuration missing' };
    }

    try {
        const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);

        // 1. Ensure "Measurements" folder exists for this project
        let targetProjectId = projectId;

        const { data: folders, error: folderError } = await supabase
            .from('projects')
            .select('id')
            .eq('parent_project_id', projectId)
            .eq('is_measurements_folder', true)
            .limit(1);

        if (folderError) {
            logger.error('Error checking measurement folder:', folderError);
        }

        if (folders && folders.length > 0 && folders[0]) {
            targetProjectId = folders[0].id;
        } else {
            // Create the folder
            const folderId = uuidv4();
            const { error: createError } = await supabase.from('projects').insert({
                id: folderId,
                name: 'Ölçümler',
                owner_id: userId,
                parent_project_id: projectId,
                is_measurements_folder: true,
                created_at: new Date().toISOString()
            });

            if (createError) {
                logger.error('Error creating measurement folder:', createError);
            } else {
                targetProjectId = folderId;
            }
        }

        // 2. Create the annotation asset
        const newAsset: AssetLayer = {
            id: uuidv4(),
            project_id: targetProjectId,
            name: `${name} (${text})`,
            type: LayerType.ANNOTATION,
            storage_path: '', // No R2 path for annotations
            url: '',
            visible: true,
            opacity: 1,
            data: {
                text,
                geometry,
                mode
            },
            status: AssetStatus.READY
        };

        const { error: insertError } = await supabase.from('assets').insert({
            id: newAsset.id,
            project_id: newAsset.project_id,
            name: newAsset.name,
            type: newAsset.type,
            storage_path: newAsset.storage_path,
            data: newAsset.data,
            status: newAsset.status
        });

        if (insertError) {
            logger.error('Error saving measurement annotation:', insertError);
            return { success: false, error: 'Tabloya kaydedilemedi' };
        }

        return { success: true, data: newAsset };

    } catch (e) {
        logger.error('Supabase exception in saveMeasurementAsAnnotation:', e);
        return { success: false, error: 'Beklenmedik bir hata oluştu' };
    }
}
