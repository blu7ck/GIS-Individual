/**
 * Parcel Query Feature - Shared Types
 */

export type ParcelQueryMode = 'by_click' | 'by_admin';

export type ParcelQueryInput =
    | { mode: 'by_click'; lat: number; lon: number }
    | { mode: 'by_admin'; mahalleId: number | string; adaNo: number | string; parselNo: number | string };

export type TkgmGeoJsonFeature = {
    type: 'Feature';
    geometry: {
        type: 'Polygon' | 'MultiPolygon';
        coordinates: any;
    };
    properties: {
        id?: string;
        ilAd?: string;
        ilceAd?: string;
        mahalleAd?: string;
        adaNo?: string;
        parselNo?: string;
        alan?: string;
        mevkii?: string;
        nitelik?: string;
        zeminId?: string;
        [key: string]: any;
    };
};

export type ParcelMetrics = {
    area_m2: number;
    perimeter_m: number;
    centroid: { lon: number; lat: number };
    bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number };
    verticesWgs84: Array<{ lon: number; lat: number }>;
    edges: Array<{
        length_m: number;
        bearing_deg: number;
        angle_deg?: number; // Internal angle at this vertex
    }>;
    // Engineering / Surveying extras
    aspect_deg?: number;     // Bakı (Slope direction)
    slope_deg?: number;      // Eğim (Average slope)
    solar_exposure?: string; // Güneş alma süresi açıklaması/kategorisi
};

export type ParcelElevation = {
    min_m: number;
    max_m: number;
    mean_m: number;
    points: Array<{ lon: number; lat: number; elevation: number }>;
};

export type ParcelResult = {
    feature: TkgmGeoJsonFeature;
    metrics: ParcelMetrics;
    elevation?: ParcelElevation;
    query_key: string;
};

export interface AdminHierarchyNode {
    id: number;
    text: string;
}

export type SavedParcelQuery = {
    id: string;
    user_id: string;
    name: string;
    query_mode: ParcelQueryMode;
    query_key: string;
    tkgm_properties: Record<string, any>;
    geometry_geojson: TkgmGeoJsonFeature['geometry'];
    metrics: ParcelMetrics;
    elevation?: ParcelElevation;
    created_at: string;
    updated_at: string;
};
