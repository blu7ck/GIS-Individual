import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

import { MeasurementMode } from '../../../types';

interface MeasurementRendererProps {
    points: Cesium.Cartesian3[];
    measurementText: string;
    measurementPosition: Cesium.Cartesian3 | null;
    tempPoint?: Cesium.Cartesian3 | null;
    viewer?: Cesium.Viewer | null;
    mode: MeasurementMode;
}

export const MeasurementRenderer: React.FC<MeasurementRendererProps> = ({
    points,
    measurementText,
    measurementPosition,
    tempPoint,
    viewer,
    mode
}) => {
    const polylineEntityRef = useRef<Cesium.Entity | null>(null);
    const polygonEntityRef = useRef<Cesium.Entity | null>(null);
    const labelEntityRef = useRef<Cesium.Entity | null>(null);
    const tempPolylineRef = useRef<Cesium.Entity | null>(null);
    const pointEntitiesRef = useRef<Cesium.Entity[]>([]);

    // Refs for continuous rendering (bypass React state lag)
    const latestPoints = useRef(points);
    const latestTempPoint = useRef(tempPoint);

    // Sync refs on render
    latestPoints.current = points;
    latestTempPoint.current = tempPoint;

    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        const getDrawingColor = () => {
            switch (mode) {
                case MeasurementMode.DISTANCE: return Cesium.Color.fromCssColorString('#FBBF24');
                case MeasurementMode.AREA:
                case MeasurementMode.DRAW_POLYGON: return Cesium.Color.fromCssColorString('#F97316');
                case MeasurementMode.SPOT_HEIGHT: return Cesium.Color.fromCssColorString('#D946EF');
                case MeasurementMode.SLOPE: return Cesium.Color.fromCssColorString('#84CC16');
                case MeasurementMode.LINE_OF_SIGHT: return Cesium.Color.fromCssColorString('#06B6D4');
                case MeasurementMode.CONVEX_HULL: return Cesium.Color.fromCssColorString('#A855F7');
                case MeasurementMode.PROFILE: return Cesium.Color.fromCssColorString('#3B82F6');
                case MeasurementMode.VOLUME: return Cesium.Color.fromCssColorString('#92400E');
                default: return Cesium.Color.YELLOW;
            }
        };

        const themeColor = getDrawingColor();

        // 1. Points
        if (pointEntitiesRef.current.length !== points.length) {
            pointEntitiesRef.current.forEach(e => viewer.entities.remove(e));
            pointEntitiesRef.current = points.map(p => viewer.entities.add({
                position: p,
                point: { pixelSize: 8, color: themeColor, outlineColor: Cesium.Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY }
            }));
        } else {
            points.forEach((p, i) => {
                if (pointEntitiesRef.current[i]) pointEntitiesRef.current[i].position = p as any;
            });
        }

        // 2. Polyline (Static/Completed segments)
        if (points.length >= 2) {
            const polylinePositions = [...points];
            const isPolygonMode = [MeasurementMode.AREA, MeasurementMode.DRAW_POLYGON, MeasurementMode.CONVEX_HULL, MeasurementMode.VOLUME].includes(mode);
            if (isPolygonMode && points.length >= 3 && points[0]) polylinePositions.push(points[0]);

            if (!polylineEntityRef.current) {
                polylineEntityRef.current = viewer.entities.add({
                    polyline: { positions: polylinePositions, width: 3, material: themeColor, clampToGround: true }
                });
            } else {
                polylineEntityRef.current.polyline!.positions = polylinePositions as any;
                polylineEntityRef.current.polyline!.material = themeColor as any;
            }
        } else if (polylineEntityRef.current) {
            viewer.entities.remove(polylineEntityRef.current);
            polylineEntityRef.current = null;
        }

        // 3. Temp/Rubber-band (Dynamic)
        // Correct implementation: Use CallbackProperty to read form Refs directly
        if (!tempPolylineRef.current) {
            tempPolylineRef.current = viewer.entities.add({
                polyline: {
                    positions: new Cesium.CallbackProperty(() => {
                        const currentPoints = latestPoints.current;
                        const currentTemp = latestTempPoint.current;

                        if (currentPoints.length >= 1 && currentTemp) {
                            const lastPoint = currentPoints[currentPoints.length - 1];
                            return [lastPoint, currentTemp];
                        }
                        return [];
                    }, false),
                    width: 4, // Thicker
                    material: new Cesium.PolylineDashMaterialProperty({
                        color: Cesium.Color.WHITE, // Distinct White
                        dashLength: 16
                    }),
                    clampToGround: true
                }
            });
        }

        // Ensure visibility based on state
        if (tempPolylineRef.current) {
            // We don't set positions here manually anymore!
            // We just toggle visibility if needed, but Callback returns [] if invalid valid anyway.
            // Force update
            tempPolylineRef.current.show = (!!tempPoint && points.length >= 1);
        }

        // 4. Polygon
        const isPolygonMode = [MeasurementMode.AREA, MeasurementMode.DRAW_POLYGON, MeasurementMode.CONVEX_HULL, MeasurementMode.VOLUME].includes(mode);
        if (isPolygonMode && points.length >= 3) {
            if (!polygonEntityRef.current) {
                polygonEntityRef.current = viewer.entities.add({
                    polygon: { hierarchy: new Cesium.PolygonHierarchy(points), material: themeColor.withAlpha(0.2), outline: false }
                });
            } else {
                polygonEntityRef.current.polygon!.hierarchy = new Cesium.PolygonHierarchy(points) as any;
            }
        } else if (polygonEntityRef.current) {
            viewer.entities.remove(polygonEntityRef.current);
            polygonEntityRef.current = null;
        }

        // 5. Label
        if (measurementText && measurementPosition) {
            if (!labelEntityRef.current) {
                labelEntityRef.current = viewer.entities.add({
                    position: measurementPosition,
                    label: {
                        text: measurementText,
                        font: 'bold 16px Inter, sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 3,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -15),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        showBackground: true,
                        backgroundColor: new Cesium.Color(0.1, 0.1, 0.1, 0.8),
                        backgroundPadding: new Cesium.Cartesian2(10, 5)
                    }
                });
            } else {
                labelEntityRef.current.position = measurementPosition as any;
                labelEntityRef.current.label!.text = measurementText as any;
            }
        } else if (labelEntityRef.current) {
            viewer.entities.remove(labelEntityRef.current);
            labelEntityRef.current = null;
        }

        viewer.scene.requestRender();

        return () => {
            // No full cleanup here to keep entities persistent across fast re-renders
            // But if viewer is destroyed or mode changes (handled by parent logic usually)
        };
    }, [viewer, points, tempPoint, measurementText, measurementPosition, mode]);

    // Explicit cleanup on unmount
    useEffect(() => {
        return () => {
            if (viewer && !viewer.isDestroyed()) {
                if (polylineEntityRef.current) viewer.entities.remove(polylineEntityRef.current);
                if (polygonEntityRef.current) viewer.entities.remove(polygonEntityRef.current);
                if (labelEntityRef.current) viewer.entities.remove(labelEntityRef.current);
                if (tempPolylineRef.current) viewer.entities.remove(tempPolylineRef.current);
                pointEntitiesRef.current.forEach(e => viewer.entities.remove(e));
            }
        };
    }, [viewer]);

    return null; // This component renders imperatively
};
