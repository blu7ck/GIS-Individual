import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

interface MeasurementRendererProps {
    points: Cesium.Cartesian3[];
    measurementText: string;
    measurementPosition: Cesium.Cartesian3 | null;
    viewer?: Cesium.Viewer | null;
}

export const MeasurementRenderer: React.FC<MeasurementRendererProps> = ({
    points,
    measurementText,
    measurementPosition,
    viewer
}) => {
    const polylineEntityRef = useRef<Cesium.Entity | null>(null);
    const labelEntityRef = useRef<Cesium.Entity | null>(null);
    const pointEntitiesRef = useRef<Cesium.Entity[]>([]);

    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        // Cleanup old entities
        if (polylineEntityRef.current) {
            viewer.entities.remove(polylineEntityRef.current);
            polylineEntityRef.current = null;
        }
        if (labelEntityRef.current) {
            viewer.entities.remove(labelEntityRef.current);
            labelEntityRef.current = null;
        }
        pointEntitiesRef.current.forEach(e => viewer.entities.remove(e));
        pointEntitiesRef.current = [];

        // Create point entities
        points.forEach((point) => {
            const pointEntity = viewer.entities.add({
                position: point,
                point: {
                    pixelSize: 10,
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2
                }
            });
            pointEntitiesRef.current.push(pointEntity);
        });

        // Create polyline if we have 2+ points
        if (points.length >= 2) {
            polylineEntityRef.current = viewer.entities.add({
                polyline: {
                    positions: points,
                    width: 3,
                    material: Cesium.Color.YELLOW,
                    clampToGround: true
                }
            });
        }

        // Create label if we have text and position
        if (measurementText && measurementPosition) {
            labelEntityRef.current = viewer.entities.add({
                position: measurementPosition,
                label: {
                    text: measurementText,
                    font: '14px sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -10),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
            });
        }

        // Cleanup on unmount or when dependencies change
        return () => {
            if (viewer && !viewer.isDestroyed()) {
                if (polylineEntityRef.current) viewer.entities.remove(polylineEntityRef.current);
                if (labelEntityRef.current) viewer.entities.remove(labelEntityRef.current);
                pointEntitiesRef.current.forEach(e => viewer.entities.remove(e));
            }
        };
    }, [viewer, points, measurementText, measurementPosition]);

    return null; // This component renders imperatively
};
