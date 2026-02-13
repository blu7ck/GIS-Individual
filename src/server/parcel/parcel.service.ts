/**
 * Parcel Query Service - Supabase Handlers
 */
import { createSupabaseClient } from '../../lib/supabase';
import { StorageConfig, LayerType, AssetStatus } from '../../types';
import { SavedParcelQuery, ParcelResult } from '../../shared/parcel/types';
import { logger } from '../../utils/logger';
import { uploadToR2 } from '../../services/storage';
import { parcelToKml } from './kml';
import { v4 as uuidv4 } from 'uuid';

export class ParcelQueryService {
    /**
     * Save a parcel query result to Supabase
     */
    async saveQuery(
        userId: string,
        name: string,
        result: ParcelResult,
        mode: string,
        config: StorageConfig
    ): Promise<SavedParcelQuery> {
        if (!config.supabaseUrl || !config.supabaseKey) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);

        const payload = {
            user_id: userId,
            name: name,
            query_mode: mode,
            query_key: result.query_key,
            tkgm_properties: result.feature.properties,
            geometry_geojson: result.feature.geometry,
            metrics: result.metrics,
            elevation: result.elevation || null,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('parcel_queries')
            .upsert(payload, { onConflict: 'user_id, query_key' })
            .select()
            .single();

        if (error) {
            logger.error('[ParcelQueryService] Failed to save query:', error);
            throw error;
        }

        return data as SavedParcelQuery;
    }

    /**
     * Optional: Save the parcel as a KML asset in R2/Assets table (for ProjectPanel)
     */
    async saveAsAsset(
        projectId: string,
        result: ParcelResult,
        config: StorageConfig
    ): Promise<void> {
        if (!config.workerUrl || !config.supabaseUrl || !config.supabaseKey) return;

        try {
            const props = result.feature.properties;
            const fileName = `parcel_${props.adaNo || '0'}_${props.parselNo || '0'}.kml`;
            const kmlString = parcelToKml(result, fileName);

            // Create a File object from the string
            const file = new File([kmlString], fileName, { type: 'application/vnd.google-earth.kml+xml' });

            // 1. Upload to R2
            const storagePath = await uploadToR2(file, config);

            // 2. Register in Supabase Assets table
            const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);
            const assetPayload = {
                id: uuidv4(),
                project_id: projectId,
                name: `Parcel: ${props.adaNo}/${props.parselNo} (${props.mahalleAd || ''})`,
                type: LayerType.KML,
                storage_path: storagePath,
                data: {
                    isParcel: true,
                    metrics: result.metrics,
                    properties: result.feature.properties,
                    elevation: result.elevation
                },
                status: AssetStatus.READY,
                created_at: new Date().toISOString()
            };

            const { error } = await supabase.from('assets').insert(assetPayload);
            if (error) throw error;

            logger.info('[ParcelQueryService] Saved as asset successfully:', fileName);
        } catch (err) {
            logger.error('[ParcelQueryService] Failed to save as asset:', err);
            throw err;
        }
    }

    /**
     * List all saved parcel queries for a user
     */
    async listQueries(userId: string, config: StorageConfig): Promise<SavedParcelQuery[]> {
        if (!config.supabaseUrl || !config.supabaseKey) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);

        const { data, error } = await supabase
            .from('parcel_queries')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('[ParcelQueryService] Failed to fetch queries:', error);
            throw error;
        }

        return data as SavedParcelQuery[];
    }

    /**
     * Delete a saved query
     */
    async deleteQuery(id: string, config: StorageConfig): Promise<void> {
        if (!config.supabaseUrl || !config.supabaseKey) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createSupabaseClient(config.supabaseUrl, config.supabaseKey);
        const { error } = await supabase.from('parcel_queries').delete().eq('id', id);

        if (error) {
            logger.error('[ParcelQueryService] Failed to delete query:', error);
            throw error;
        }
    }
}

export const parcelQueryService = new ParcelQueryService();
