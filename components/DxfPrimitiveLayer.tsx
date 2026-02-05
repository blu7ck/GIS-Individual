import React, { useMemo, useEffect, useState, useImperativeHandle } from 'react';
import * as Cesium from 'cesium';
import { simplify } from '@turf/turf';
import { GroundPolylinePrimitive, PointPrimitiveCollection, PointPrimitive } from 'resium';

interface DxfPrimitiveLayerProps {
    data?: any; // GeoJSON object or string
    url?: string; // URL to GeoJSON file
    visible: boolean;
    color?: Cesium.Color;
    opacity?: number;
}

// Interface for the ref exposed by this component
export interface DxfPrimitiveLayerRef {
    getBoundingSphere: () => Cesium.BoundingSphere | null;
}

export const DxfPrimitiveLayer = React.forwardRef<DxfPrimitiveLayerRef, DxfPrimitiveLayerProps>(({
    data,
    url,
    visible,
    color = Cesium.Color.YELLOW,
    opacity = 1.0
}, ref) => {
    const [geoJSON, setGeoJSON] = useState<any>(null);
    const [boundingSphere, setBoundingSphere] = useState<Cesium.BoundingSphere | null>(null);

    // Parse GeoJSON securely or fetch from URL
    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            if (data) {
                if (typeof data === 'string') {
                    try {
                        const parsed = JSON.parse(data);
                        if (isMounted) setGeoJSON(parsed);
                    } catch (e) {
                        console.error('Failed to parse DXF GeoJSON string', e);
                        if (isMounted) setGeoJSON(null);
                    }
                } else {
                    if (isMounted) setGeoJSON(data);
                }
            } else if (url) {
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const json = await response.json();
                    if (isMounted) setGeoJSON(json);
                } catch (e) {
                    console.error('Failed to fetch DXF GeoJSON from URL', e);
                    if (isMounted) setGeoJSON(null);
                }
            } else {
                if (isMounted) setGeoJSON(null);
            }
        };

        loadData();

        return () => { isMounted = false; };
    }, [data, url]);

    // Generate Geometry Instances for Lines
    const lineInstances = useMemo(() => {
        if (!geoJSON || !geoJSON.features) return [];

        const instances: Cesium.GeometryInstance[] = [];

        // 0.00001 degrees is ~1.1 meters. GOOD balance.
        const TOLERANCE = 0.00001;

        geoJSON.features.forEach((feature: any, index: number) => {
            if (!feature.geometry) return;

            // Simplify feature geometry to reduce vertex count (critical for performance)
            // Clone feature to avoid mutating original if needed, though here we just process
            // We only simplify LineString and Polygon, points are already simple
            let geometry = feature.geometry;
            try {
                if (geometry.type === 'LineString' || geometry.type === 'Polygon' || geometry.type === 'MultiLineString') {
                    const simplified = simplify(feature, { tolerance: TOLERANCE, highQuality: false, mutate: false });
                    geometry = simplified.geometry;
                }
            } catch (e) {
                // Fallback to original if simplification fails
                console.warn('Simplification failed for feature', index, e);
            }

            const type = geometry.type;
            const coords = geometry.coordinates;

            if (type === 'LineString') {
                const positions = coords.map((c: number[]) => Cesium.Cartesian3.fromDegrees(c[0] ?? 0, c[1] ?? 0));
                if (positions.length < 2) return;

                instances.push(new Cesium.GeometryInstance({
                    geometry: new Cesium.GroundPolylineGeometry({
                        positions: positions,
                        width: 2.0
                    }),
                    id: `dxf-line-${index}`,
                    attributes: {
                        color: Cesium.ColorGeometryInstanceAttribute.fromColor(color.withAlpha(opacity))
                    }
                }));
            } else if (type === 'MultiLineString') {
                coords.forEach((lineCoords: number[][], subIndex: number) => {
                    const positions = lineCoords.map((c: number[]) => Cesium.Cartesian3.fromDegrees(c[0] ?? 0, c[1] ?? 0));
                    if (positions.length < 2) return;

                    instances.push(new Cesium.GeometryInstance({
                        geometry: new Cesium.GroundPolylineGeometry({
                            positions: positions,
                            width: 2.0
                        }),
                        id: `dxf-multiline-${index}-${subIndex}`,
                        attributes: {
                            color: Cesium.ColorGeometryInstanceAttribute.fromColor(color.withAlpha(opacity))
                        }
                    }));
                });
            } else if (type === 'Polygon') {
                // Draw polygon outline (first ring is exterior)
                if (coords.length > 0) {
                    const positions = coords[0]!.map((c: number[]) => Cesium.Cartesian3.fromDegrees(c[0] ?? 0, c[1] ?? 0));
                    if (positions.length < 2) return;

                    instances.push(new Cesium.GeometryInstance({
                        geometry: new Cesium.GroundPolylineGeometry({
                            positions: positions,
                            width: 2.0,
                            loop: true
                        }),
                        id: `dxf-polygon-${index}`,
                        attributes: {
                            color: Cesium.ColorGeometryInstanceAttribute.fromColor(color.withAlpha(opacity))
                        }
                    }));
                }
            }
        });

        return instances;
    }, [geoJSON, color, opacity]);

    // Calculate bounding sphere when GeoJSON changes
    useEffect(() => {
        if (!geoJSON || !geoJSON.features) {
            setBoundingSphere(null);
            return;
        }

        const allPositions: Cesium.Cartesian3[] = [];

        geoJSON.features.forEach((feature: any) => {
            if (!feature.geometry) return;
            const coords = feature.geometry.coordinates;
            const type = feature.geometry.type;

            const addCoords = (c: number[]) => {
                allPositions.push(Cesium.Cartesian3.fromDegrees(c[0] ?? 0, c[1] ?? 0));
            };

            if (type === 'LineString') {
                coords.forEach(addCoords);
            } else if (type === 'MultiLineString') {
                coords.forEach((line: number[][]) => line.forEach(addCoords));
            } else if (type === 'Polygon') {
                if (coords.length > 0) coords[0].forEach(addCoords);
            } else if (type === 'Point') {
                addCoords(coords);
            }
        });

        if (allPositions.length > 0) {
            setBoundingSphere(Cesium.BoundingSphere.fromPoints(allPositions));
        } else {
            setBoundingSphere(null);
        }
    }, [geoJSON]);

    // Expose method to parent
    useImperativeHandle(ref, () => ({
        getBoundingSphere: () => boundingSphere
    }));

    // Generate Point Primitives
    const pointFeatures = useMemo(() => {
        if (!geoJSON || !geoJSON.features) return [];
        return geoJSON.features.filter((f: any) => f.geometry && f.geometry.type === 'Point');
    }, [geoJSON]);

    if (!lineInstances.length && !pointFeatures.length) return null;

    return (
        <>
            {lineInstances.length > 0 && (
                <GroundPolylinePrimitive
                    show={visible}
                    geometryInstances={lineInstances}
                    appearance={new Cesium.PolylineColorAppearance({
                        translucent: opacity < 1.0
                    })}
                    asynchronous={true}
                />
            )}

            {pointFeatures.length > 0 && (
                <PointPrimitiveCollection show={visible}>
                    {pointFeatures.map((feature: any, index: number) => {
                        const coords = feature.geometry.coordinates;
                        return (
                            <PointPrimitive
                                key={`dxf-point-${index}`}
                                position={Cesium.Cartesian3.fromDegrees(coords[0], coords[1])}
                                color={color.withAlpha(opacity)}
                                pixelSize={5}
                                disableDepthTestDistance={Number.POSITIVE_INFINITY}
                            />
                        );
                    })}
                </PointPrimitiveCollection>
            )}
        </>
    );
});

DxfPrimitiveLayer.displayName = 'DxfPrimitiveLayer';
