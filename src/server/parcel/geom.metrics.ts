/**
 * Parcel Geometry Metrics - Engineering & Surveying Calculations
 */
import * as turf from '@turf/turf';
import { TkgmGeoJsonFeature, ParcelMetrics, ParcelElevation } from '../../shared/parcel/types';

/**
 * Computes geometric metrics for a given parsel feature
 */
export function computeParcelMetrics(feature: TkgmGeoJsonFeature, elevation?: ParcelElevation): ParcelMetrics {
    const geom = feature.geometry;

    // Extract polygon coordinates
    // Handling Polygon and MultiPolygon (takes first ring of first polygon)
    const coords = geom.type === 'Polygon'
        ? geom.coordinates[0]
        : geom.coordinates[0][0];

    const verticesWgs84 = coords.map(([lon, lat]: [number, number]) => ({ lon, lat }));

    const poly = turf.polygon(geom.type === 'Polygon' ? geom.coordinates : [geom.coordinates[0]]);
    const area_m2 = turf.area(poly);

    // Perimeter (sum of edge lengths)
    const line = turf.lineString(coords);
    const perimeter_m = turf.length(line, { units: 'kilometers' }) * 1000;

    // Centroid
    const c = turf.centroid(poly).geometry.coordinates as [number, number];

    // Bounding Box
    const bboxArr = turf.bbox(poly); // [minX, minY, maxX, maxY]

    // Edge metrics (length and bearing)
    const edges: ParcelMetrics['edges'] = [];
    for (let i = 0; i < coords.length - 1; i++) {
        const p1 = turf.point(coords[i]);
        const p2 = turf.point(coords[i + 1]);
        const length_m = turf.distance(p1, p2, { units: 'kilometers' }) * 1000;
        const bearing_deg = turf.bearing(p1, p2);

        edges.push({ length_m, bearing_deg });
    }

    // Calculate Aspect (Bakı) and Slope (Eğim) if elevation data is available
    let aspect_deg: number | undefined;
    let slope_deg: number | undefined;
    let solar_exposure: string | undefined;

    if (elevation && elevation.points.length >= 3) {
        // Simple planar regression logic for slope/aspect based on vertices
        // For a more professional survey, we compute the normal of the vertices
        const result = calculateSlopeAndAspect(elevation.points);
        aspect_deg = result.aspect;
        slope_deg = result.slope;
        solar_exposure = determineSolarExposure(aspect_deg, slope_deg);
    }

    return {
        area_m2,
        perimeter_m,
        centroid: { lon: c[0], lat: c[1] },
        bbox: { minLon: bboxArr[0], minLat: bboxArr[1], maxLon: bboxArr[2], maxLat: bboxArr[3] },
        verticesWgs84,
        edges,
        aspect_deg,
        slope_deg,
        solar_exposure
    };
}

/**
 * Basic slope and aspect calculation from a set of points (lon, lat, elev)
 * Uses a best-fit plane approach or averaging normals
 */
function calculateSlopeAndAspect(points: Array<{ lon: number; lat: number; elevation: number }>) {
    // This is a simplified calculation. 
    // In a real survey, we'd use a more robust Least Squares fit for ax + by + cz + d = 0
    // But for 3-4 points of a parcel, we can average the triangle normals

    // Convert to relative meters (approx)
    const meanLon = points.reduce((s, p) => s + p.lon, 0) / points.length;
    const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length;

    // Scale factor for lon/lat to meters (Turkish average: ~111km per lat, ~85km per lon)
    const latToM = 111320;
    const lonToM = 111320 * Math.cos(meanLat * Math.PI / 180);

    const localPoints = points.map(p => ({
        x: (p.lon - meanLon) * lonToM,
        y: (p.lat - meanLat) * latToM,
        z: p.elevation
    }));

    // Simplified: Take 3 points if possible to define a plane normal
    if (localPoints.length < 3) return { slope: 0, aspect: 0 };

    // Normal calculation from first 3 points cross product
    const p0 = localPoints[0]!;
    const p1 = localPoints[1]!;
    const p2 = localPoints[2]!;

    const v1 = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
    const v2 = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };

    const nx = v1.y * v2.z - v1.z * v2.y;
    const ny = v1.z * v2.x - v1.x * v2.z;
    const nz = v1.x * v2.y - v1.y * v2.x;

    // Magnitude of horizontal component
    const horiz = Math.sqrt(nx * nx + ny * ny);

    // Slope: Angle between normal and vertical axis (in degrees)
    // tan(slope) = horiz / |nz|
    let slope = Math.atan2(horiz, Math.abs(nz)) * (180 / Math.PI);

    // Aspect: Direction of the horizontal projection of the normal
    // atan2(ny, nx) gives direction in radians from X axis
    // We want compass bearing (0=N, 90=E, 180=S, 270=W)
    let aspect = 90 - (Math.atan2(ny, nx) * (180 / Math.PI));
    if (aspect < 0) aspect += 360;
    if (aspect >= 360) aspect -= 360;

    return { slope, aspect };
}

/**
 * Determine descriptive solar exposure based on aspect and slope
 */
function determineSolarExposure(aspect: number, slope: number): string {
    if (slope < 2) return 'Düzlük (Tüm gün güneş)';

    // Northern Hemisphere rules (Turkey)
    if (aspect >= 135 && aspect <= 225) return 'Güney Bakı (Maksimum Güneş)';
    if (aspect > 225 && aspect < 315) return 'Batı Bakı (Öğleden sonra güneş)';
    if (aspect > 45 && aspect < 135) return 'Doğu Bakı (Sabah Güneşi)';
    return 'Kuzey Bakı (Düşük Güneş)';
}
