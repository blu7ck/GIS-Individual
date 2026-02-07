import shp from 'shpjs';
import { featureCollection } from '@turf/turf';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

/**
 * Type guard for GeoJSON FeatureCollection
 */
function isFeatureCollection(obj: unknown): obj is FeatureCollection {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as any).type === 'FeatureCollection' &&
    Array.isArray((obj as any).features)
  );
}

/**
 * Type guard for GeoJSON Feature
 */
function isFeature(obj: unknown): obj is Feature<Geometry> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as any).type === 'Feature' &&
    (obj as any).geometry !== undefined
  );
}

/**
 * Production-ready Shapefile to GeoJSON converter
 * Converts Shapefile ZIP to GeoJSON FeatureCollection
 */
export const shpToGeoJSON = async (zipFile: File | Blob): Promise<FeatureCollection> => {
  try {
    const arrayBuffer = await zipFile.arrayBuffer();
    const geojson: unknown = await shp.parseZip(arrayBuffer);

    // shpjs sometimes returns an array
    if (Array.isArray(geojson)) {
      const allFeatures: Feature[] = [];

      for (const item of geojson) {
        if (isFeatureCollection(item)) {
          allFeatures.push(...item.features);
        } else if (isFeature(item)) {
          allFeatures.push(item);
        } else {
          throw new Error('Unsupported item in shpjs array output');
        }
      }

      return featureCollection(allFeatures as Feature<Geometry>[]);
    }

    // Single FeatureCollection Case
    if (isFeatureCollection(geojson)) return geojson;

    // Single Feature Case
    if (isFeature(geojson)) return featureCollection([geojson]);

    throw new Error('Unsupported shpjs output format');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Failed to parse shapefile: ${message}`);
  }
};
