import * as turf from '@turf/turf';
import * as Cesium from 'cesium';

/**
 * Export measurement geometry to GeoJSON format
 */
export const exportMeasurementToGeoJSON = (geometry: any): string => {
  if (geometry.geojson) {
    // Already in GeoJSON format
    return JSON.stringify(geometry.geojson, null, 2);
  }
  
  // Convert old format (points array) → GeoJSON
  if (geometry.points && geometry.points.length >= 3) {
    const coordinates = geometry.points.map((p: any) => {
      const cartesian = new Cesium.Cartesian3(p.x, p.y, p.z);
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      return [
        Cesium.Math.toDegrees(cartographic.longitude),
        Cesium.Math.toDegrees(cartographic.latitude)
      ] as [number, number];
    });
    
    let feature: turf.Feature<turf.Polygon | turf.LineString>;
    
    if (geometry.type === 'Polygon') {
      // Close polygon
      if (coordinates.length > 0) {
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coordinates.push([...first] as [number, number]);
        }
      }
      feature = turf.polygon([coordinates]);
    } else {
      feature = turf.lineString(coordinates);
    }
    
    return JSON.stringify(feature, null, 2);
  }
  
  return JSON.stringify({ error: 'Invalid geometry format' }, null, 2);
};

/**
 * Download GeoJSON as a file
 */
export const downloadGeoJSON = (geoJSON: string, filename: string = 'measurement.geojson') => {
  const blob = new Blob([geoJSON], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

