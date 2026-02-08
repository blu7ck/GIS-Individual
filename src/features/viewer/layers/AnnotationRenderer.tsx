import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import { AssetLayer, LayerType } from '../../../types';

interface AnnotationRendererProps {
    layers: AssetLayer[];
    viewer: Cesium.Viewer | null;
}

export const AnnotationRenderer: React.FC<AnnotationRendererProps> = ({ layers, viewer }) => {
    const entitiesRef = useRef<Map<string, { entities: Cesium.Entity[], dataHash: string }>>(new Map());

    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        const annotationLayers = layers.filter(l => l.type === LayerType.ANNOTATION && l.visible);
        const currentIds = new Set(annotationLayers.map(l => l.id));

        // 1. Cleanup removed or hidden layers
        entitiesRef.current.forEach((info, id) => {
            if (!currentIds.has(id)) {
                info.entities.forEach(e => viewer.entities.remove(e));
                entitiesRef.current.delete(id);
            }
        });

        // 2. Add/Update layers
        annotationLayers.forEach(layer => {
            const annotation = layer.data;
            if (!annotation || !annotation.geometry) return;

            // Simple hash/check to prevent re-rendering same data
            const dataHash = JSON.stringify(annotation);
            const existing = entitiesRef.current.get(layer.id);
            if (existing && existing.dataHash === dataHash) return;

            // If existing but hash changed, clear old first
            if (existing) {
                existing.entities.forEach(e => viewer.entities.remove(e));
            }

            const { geometry, text } = annotation;
            const points = geometry.points?.map((p: any) => new Cesium.Cartesian3(p.x, p.y, p.z)) || [];
            if (points.length === 0) return;

            const newEntities: Cesium.Entity[] = [];
            const mode = (annotation.mode || annotation.geometry?.mode) as string;
            let color = Cesium.Color.YELLOW;

            // Map modes to colors (Matching MeasurementRenderer)
            switch (mode) {
                case 'DISTANCE': color = Cesium.Color.fromCssColorString('#FBBF24'); break;
                case 'AREA':
                case 'DRAW_POLYGON': color = Cesium.Color.fromCssColorString('#F97316'); break;
                case 'SPOT_HEIGHT': color = Cesium.Color.fromCssColorString('#D946EF'); break;
                case 'SLOPE': color = Cesium.Color.fromCssColorString('#84CC16'); break;
                case 'LINE_OF_SIGHT': color = Cesium.Color.fromCssColorString('#06B6D4'); break;
                case 'CONVEX_HULL': color = Cesium.Color.fromCssColorString('#A855F7'); break;
                case 'PROFILE': color = Cesium.Color.fromCssColorString('#3B82F6'); break;
                case 'VOLUME': color = Cesium.Color.fromCssColorString('#92400E'); break;
                default: color = Cesium.Color.YELLOW;
            }

            const themeColor = color.withAlpha(0.8);

            // Render based on geometry type
            if (geometry.type === 'Point' && points[0]) {
                newEntities.push(viewer.entities.add({
                    properties: { layerId: layer.id },
                    position: points[0],
                    point: { pixelSize: 10, color: themeColor, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
                    label: {
                        text,
                        font: '14px Inter, sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 3,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -15),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                }));
            } else if (geometry.type === 'LineString' || geometry.type === 'Polyline') {
                newEntities.push(viewer.entities.add({
                    properties: { layerId: layer.id },
                    polyline: {
                        positions: points,
                        width: 3,
                        material: themeColor,
                        clampToGround: true
                    }
                }));

                // Label at center
                const center = points[Math.floor(points.length / 2)];
                newEntities.push(viewer.entities.add({
                    properties: { layerId: layer.id },
                    position: center,
                    label: {
                        text,
                        font: '14px Inter, sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 3,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -10),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                }));
            } else if (geometry.type === 'Polygon') {
                newEntities.push(viewer.entities.add({
                    properties: { layerId: layer.id },
                    polygon: {
                        hierarchy: points,
                        material: themeColor.withAlpha(0.3),
                        classificationType: Cesium.ClassificationType.BOTH
                    },
                    polyline: {
                        positions: [...points, points[0]], // Close loop
                        width: 2,
                        material: themeColor,
                        clampToGround: true
                    }
                }));

                // Label at center (roughly)
                const center = points[0]; // Simple fallback
                newEntities.push(viewer.entities.add({
                    properties: { layerId: layer.id },
                    position: center,
                    label: {
                        text,
                        font: '14px Inter, sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 3,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -10),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                }));
            }

            entitiesRef.current.set(layer.id, { entities: newEntities, dataHash });
        });

        viewer.scene.requestRender();

        return () => {
            // Cleanup on unmount
            entitiesRef.current.forEach(info => {
                info.entities.forEach(e => viewer.entities.remove(e));
            });
            entitiesRef.current.clear();
        };
    }, [viewer, layers]);

    return null;
};
