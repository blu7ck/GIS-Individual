import {
    ArcGisMapServerImageryProvider,
    UrlTemplateImageryProvider
} from 'cesium';
import { MapType } from '../../../../types';
import { ImageryProviderType } from './imageryTypes';
import { logger } from '../../../../utils/logger';

/**
 * Factory to create imagery provider based on MapType
 * Simplified to only support OPENSTREETMAP and TERRAIN_3D
 */
export async function createImageryProvider(mapType: MapType): Promise<ImageryProviderType | null> {
    try {
        switch (mapType) {
            case MapType.OPENSTREETMAP:
                // Standard OSM - most reliable, no API key needed
                return new UrlTemplateImageryProvider({
                    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    subdomains: ['a', 'b', 'c'],
                    maximumLevel: 19
                });

            case MapType.TERRAIN_3D:
                // ArcGIS World Street Map for 3D terrain visualization
                return await createArcGisProvider(
                    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer'
                );

            default:
                // Fallback to OSM
                logger.warn(`Unknown map type: ${mapType}, falling back to OSM`);
                return new UrlTemplateImageryProvider({
                    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    subdomains: ['a', 'b', 'c'],
                    maximumLevel: 19
                });
        }
    } catch (error) {
        logger.error('Failed to create imagery provider, using fallback OSM', error);
        // Ultimate fallback - always return something
        try {
            return new UrlTemplateImageryProvider({
                url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                subdomains: ['a', 'b', 'c'],
                maximumLevel: 19
            });
        } catch {
            return null;
        }
    }
}

async function createArcGisProvider(url: string): Promise<ArcGisMapServerImageryProvider> {
    if (ArcGisMapServerImageryProvider.fromUrl) {
        return await ArcGisMapServerImageryProvider.fromUrl(url);
    }
    throw new Error("ArcGisMapServerImageryProvider.fromUrl is not supported in this Cesium version");
}
