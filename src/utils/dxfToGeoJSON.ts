import DxfParser from 'dxf-parser';
import { Feature, FeatureCollection, featureCollection, lineString, polygon, circle, point } from '@turf/turf';

export interface DxfToGeoJSONOptions {
  defaultZ?: number;
  // Reference point for local coordinate systems (longitude, latitude)
  referencePoint?: [number, number];
  // Auto-detect if coordinates are in local system and center them
  autoCenter?: boolean;
  // Scale factor if coordinates are in non-geographic units (e.g., mm, cm)
  scaleFactor?: number;
  // If true, skip all transformations - use coordinates as-is (for real-world coordinates like WGS84/UTM)
  noTransform?: boolean;
}

/**
 * Production-ready DXF to GeoJSON converter
 * Handles both geographic and local coordinate systems
 * Automatically detects coordinate system and applies transformations
 */
export const dxfToGeoJSON = async (
  dxfContent: string | ArrayBuffer,
  options: DxfToGeoJSONOptions = {}
): Promise<FeatureCollection> => {
  try {
    const parser = new DxfParser();

    let dxf;
    if (typeof dxfContent === 'string') {
      dxf = parser.parse(dxfContent);
    } else {
      const text = new TextDecoder('utf-8').decode(dxfContent);
      dxf = parser.parse(text);
    }

    const features: Feature[] = [];
    const defaultZ = options.defaultZ || 0;

    // Collect all coordinates to calculate bounding box
    const allCoords: number[][] = [];

    // First pass: collect all coordinates to analyze coordinate system
    if (dxf?.entities && Array.isArray(dxf.entities)) {
      dxf.entities.forEach((entity: any) => {
        try {
          switch (entity.type) {
            case 'LINE':
              if (entity.start && entity.end) {
                allCoords.push([entity.start.x, entity.start.y]);
                allCoords.push([entity.end.x, entity.end.y]);
              }
              break;
            case 'POLYLINE':
            case 'LWPOLYLINE':
              if (entity.vertices && entity.vertices.length > 0) {
                entity.vertices.forEach((v: any) => {
                  allCoords.push([v.x, v.y]);
                });
              }
              break;
            case 'CIRCLE':
              if (entity.center) {
                allCoords.push([entity.center.x, entity.center.y]);
              }
              break;
            case 'ARC':
              if (entity.center) {
                allCoords.push([entity.center.x, entity.center.y]);
              }
              break;
            case 'POINT':
              if (entity.position) {
                allCoords.push([entity.position.x, entity.position.y]);
              }
              break;
          }
        } catch (error) {
          // Skip entities that cause errors
        }
      });
    }

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    allCoords.forEach(([x, y]) => {
      if (x !== undefined && y !== undefined) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    });

    // Check if coordinates are in WGS84 range (geographic)
    const isGeographic =
      minX >= -180 && maxX <= 180 &&
      minY >= -90 && maxY <= 90;

    // Calculate center and dimensions
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const width = maxX - minX;
    const height = maxY - minY;

    // Determine if we need transformation
    let offsetX = 0;
    let offsetY = 0;
    let scale = options.scaleFactor || 1;

    // If noTransform is true, skip all transformations (for real-world coordinates)
    if (options.noTransform) {
      // No transformation - use coordinates as-is (like KML)
      // This allows DXF files with real-world coordinates (WGS84, UTM, etc.) to work correctly
      scale = 1;
      offsetX = 0;
      offsetY = 0;
    } else if (!isGeographic) {
      // Local coordinate system detected
      if (options.referencePoint) {
        // Use provided reference point
        offsetX = options.referencePoint[0] - centerX;
        offsetY = options.referencePoint[1] - centerY;
      } else if (options.autoCenter !== false) {
        // Auto-center: place at a default location (e.g., center of Turkey: ~35E, 39N)
        const defaultLon = 35.0;
        const defaultLat = 39.0;
        offsetX = defaultLon - centerX;
        offsetY = defaultLat - centerY;

        // If coordinates are very large (likely in mm/cm), scale them down
        // Assume coordinates > 1000 are in mm, scale to meters
        if (Math.max(width, height) > 1000) {
          scale = 0.001; // mm to meters
        } else if (Math.max(width, height) > 10) {
          scale = 0.01; // cm to meters
        }

        // Scale to a reasonable size (max 1 degree = ~111km)
        const maxSize = Math.max(width, height) * scale;
        if (maxSize > 1.0) {
          // Scale down to fit within 1 degree
          scale = scale * (1.0 / maxSize);
        }
      }
    }

    // Transform function
    // If noTransform is true, return coordinates as-is (for real-world coordinates like KML)
    const transformCoord = (x: number, y: number): [number, number] => {
      if (options.noTransform) {
        return [x, y];
      }
      const scaledX = x * scale;
      const scaledY = y * scale;
      return [scaledX + offsetX, scaledY + offsetY];
    };

    // Second pass: process entities with transformation
    if (dxf?.entities && Array.isArray(dxf.entities)) {
      dxf.entities.forEach((entity: any) => {
        try {
          switch (entity.type) {
            case 'LINE':
              if (entity.start && entity.end) {
                const start = transformCoord(entity.start.x, entity.start.y);
                const end = transformCoord(entity.end.x, entity.end.y);
                features.push(lineString([
                  [start[0], start[1], entity.start.z || defaultZ],
                  [end[0], end[1], entity.end.z || defaultZ]
                ]));
              }
              break;

            case 'POLYLINE':
            case 'LWPOLYLINE':
              if (entity.vertices && entity.vertices.length > 0) {
                const coordinates = entity.vertices.map((v: any) => {
                  const transformed = transformCoord(v.x, v.y);
                  return [transformed[0], transformed[1], v.z || defaultZ];
                });

                if (entity.closed && coordinates.length > 0) {
                  coordinates.push(coordinates[0]);
                }

                if (entity.closed && coordinates.length >= 4) {
                  features.push(polygon([coordinates]));
                } else if (coordinates.length >= 2) {
                  features.push(lineString(coordinates));
                }
              }
              break;

            case 'CIRCLE':
              if (entity.center && entity.radius) {
                const center = transformCoord(entity.center.x, entity.center.y);
                let radius = entity.radius;

                if (options.noTransform) {
                  // For real-world coordinates, radius is already in meters or degrees
                  // Check if radius is reasonable for degrees (if > 1, assume meters and convert)
                  if (radius > 1) {
                    const radiusInDegrees = radius / 111000; // meters to degrees
                    const circleFeat = circle(center, radiusInDegrees, { steps: 64, units: 'degrees' });
                    features.push(circleFeat);
                  } else {
                    // Already in degrees
                    const circleFeat = circle(center, radius, { steps: 64, units: 'degrees' });
                    features.push(circleFeat);
                  }
                } else {
                  // Transform radius with scale
                  radius = radius * scale;
                  // Convert radius to degrees (rough conversion: 1 degree ≈ 111km)
                  const radiusInDegrees = radius / 111000;
                  const circleFeat = circle(center, radiusInDegrees, { steps: 64, units: 'degrees' });
                  features.push(circleFeat);
                }
              }
              break;

            case 'ARC':
              if (entity.center && entity.radius) {
                const center = transformCoord(entity.center.x, entity.center.y);
                let radius = entity.radius;

                if (!options.noTransform) {
                  radius = radius * scale;
                }

                const startAngle = (entity.startAngle || 0) * Math.PI / 180;
                const endAngle = (entity.endAngle || 0) * Math.PI / 180;
                const steps = Math.max(8, Math.abs(endAngle - startAngle) * 180 / Math.PI);
                const coordinates: number[][] = [];

                for (let i = 0; i <= steps; i++) {
                  const angle = startAngle + (endAngle - startAngle) * (i / steps);

                  if (options.noTransform) {
                    // For real-world coordinates, check if radius is in meters or degrees
                    if (radius > 1) {
                      const radiusInDegrees = radius / 111000; // meters to degrees
                      const x = center[0] + radiusInDegrees * Math.cos(angle);
                      const y = center[1] + radiusInDegrees * Math.sin(angle);
                      coordinates.push([x, y, defaultZ]);
                    } else {
                      // Already in degrees
                      const x = center[0] + radius * Math.cos(angle);
                      const y = center[1] + radius * Math.sin(angle);
                      coordinates.push([x, y, defaultZ]);
                    }
                  } else {
                    // Convert radius to degrees
                    const radiusInDegrees = radius / 111000;
                    const x = center[0] + radiusInDegrees * Math.cos(angle);
                    const y = center[1] + radiusInDegrees * Math.sin(angle);
                    coordinates.push([x, y, defaultZ]);
                  }
                }

                if (coordinates.length >= 2) {
                  features.push(lineString(coordinates));
                }
              }
              break;

            case 'POINT':
              if (entity.position) {
                const transformed = transformCoord(entity.position.x, entity.position.y);
                features.push(point([
                  transformed[0],
                  transformed[1],
                  entity.position.z || defaultZ
                ]));
              }
              break;

            default:
              break;
          }
        } catch (error) {
          if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
            console.warn('Error processing DXF entity:', error);
          }
        }
      });
    }

    return featureCollection(features);
  } catch (error) {
    console.error('Error parsing DXF file:', error);
    throw new Error(`Failed to parse DXF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

