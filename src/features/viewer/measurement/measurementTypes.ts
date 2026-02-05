
export interface MeasurementGeometry {
    type: 'Point' | 'LineString' | 'Polygon' | 'Polyline';
    points: { x: number; y: number; z: number }[];
    geojson?: any;
}

export interface MeasurementResult {
    text: string;
    geometry: MeasurementGeometry;
}
