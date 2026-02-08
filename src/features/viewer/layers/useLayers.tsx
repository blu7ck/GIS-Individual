import { useEffect, useMemo, useCallback } from 'react';
import * as Cesium from 'cesium';
import { AssetLayer, LayerType, QualitySettings } from '../../../types';
import { isMobileDevice } from '../utils/performance';
import { adjustKmlHeights } from './kml';
import { clampTilesetToGround, applyTilesetTransform } from './tileset';
import { flyToGeoJSON } from './geojson';

interface UseLayersProps {
    viewer: Cesium.Viewer | null;
    layers: AssetLayer[];
    flyToLayerId: string | null;
    qualitySettings: QualitySettings | null;
    onTilesetClick?: (layerId: string) => void;
    onFlyToComplete?: () => void;
    tilesetRefs: React.MutableRefObject<Map<string, Cesium.Cesium3DTileset>>;
    kmlRefs: React.MutableRefObject<Map<string, Cesium.KmlDataSource>>;
    geoJsonRefs: React.MutableRefObject<Map<string, Cesium.GeoJsonDataSource>>;
}

export function useLayers({ viewer, layers, flyToLayerId, onFlyToComplete, onTilesetClick, qualitySettings, tilesetRefs, kmlRefs, geoJsonRefs }: UseLayersProps) {

    const isMobile = useMemo(() => isMobileDevice(), []);

    // 1. Manage Quality Settings (Apply to all active tilesets)
    useEffect(() => {
        if (!viewer || viewer.isDestroyed() || !qualitySettings) return;

        tilesetRefs.current.forEach(tileset => {
            if (!tileset.isDestroyed()) {
                tileset.maximumScreenSpaceError = qualitySettings.maximumScreenSpaceError;
                // Add more settings if needed (cache size etc.)
            }
        });
    }, [qualitySettings, viewer]);

    // 2. Manage KML layers
    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        const kmlLayers = layers.filter(l => l.type === LayerType.KML && l.url);
        const currentKmlIds = new Set(kmlLayers.map(l => l.id));

        // Remove old KML sources
        kmlRefs.current.forEach((ds, id) => {
            if (!currentKmlIds.has(id)) {
                viewer.dataSources.remove(ds);
                kmlRefs.current.delete(id);
            }
        });

        // Add/update KML sources
        kmlLayers.forEach(async (layer) => {
            let ds = kmlRefs.current.get(layer.id);

            if (!ds) {
                try {
                    const kmlUrl = layer.url!.startsWith('blob:') ? `${layer.url}?v=${Date.now()}` : layer.url!;
                    ds = await Cesium.KmlDataSource.load(kmlUrl, {
                        camera: viewer.camera,
                        canvas: viewer.canvas,
                        clampToGround: true
                    });
                    viewer.dataSources.add(ds);
                    kmlRefs.current.set(layer.id, ds);
                    adjustKmlHeights(ds, viewer);
                } catch (e) {
                    console.error('[useLayers] KML load error:', e);
                }
            }

            if (ds) {
                ds.show = layer.visible;
            }
        });
    }, [viewer, layers]);

    // 3. Manage GeoJSON layers
    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        const geojsonLayers = layers.filter(l =>
            (l.type === LayerType.SHP || l.type === LayerType.DXF || l.type === LayerType.GEOJSON) &&
            l.data?.type === "FeatureCollection"
        );
        const currentIds = new Set(geojsonLayers.map(l => l.id));

        // Remove old GeoJSON sources
        geoJsonRefs.current.forEach((ds, id) => {
            if (!currentIds.has(id)) {
                viewer.dataSources.remove(ds);
                geoJsonRefs.current.delete(id);
            }
        });

        // Add/update GeoJSON sources
        geojsonLayers.forEach(async (layer) => {
            let ds = geoJsonRefs.current.get(layer.id);

            if (!ds) {
                try {
                    ds = await Cesium.GeoJsonDataSource.load(layer.data, {
                        clampToGround: true
                    });

                    // Apply standard styling and labels to entities
                    ds.entities.values.forEach(entity => {
                        // 1. Standardize Style (Blue-ish Gray, Transparent)
                        const standardColor = Cesium.Color.fromCssColorString('#A4D1E8').withAlpha(0.6); // Light blue-gray
                        const outlineColor = Cesium.Color.WHITE.withAlpha(0.8);

                        if (entity.polygon) {
                            entity.polygon.material = new Cesium.ColorMaterialProperty(standardColor);
                            entity.polygon.outline = new Cesium.ConstantProperty(true);
                            entity.polygon.outlineColor = new Cesium.ConstantProperty(outlineColor);
                        }
                        if (entity.polyline) {
                            entity.polyline.material = new Cesium.ColorMaterialProperty(outlineColor);
                            entity.polyline.width = new Cesium.ConstantProperty(2);
                        }

                        // 2. Extract Label (Smart Detection)
                        let labelText = '';
                        if (entity.properties) {
                            const props = entity.properties.getValue(Cesium.JulianDate.now());
                            if (props) {
                                // Prioritize common label keys
                                labelText = props['name'] || props['Name'] || props['NAME'] ||
                                    props['label'] || props['Label'] || props['LABEL'] ||
                                    props['id'] || props['ID'];

                                // Fallback: Use the first available property if it's short
                                if (!labelText && Object.keys(props).length > 0) {
                                    const firstValue = Object.values(props)[0];
                                    if (typeof firstValue === 'string' || typeof firstValue === 'number') {
                                        labelText = String(firstValue);
                                    }
                                }
                            }
                        }

                        // 3. Render Label
                        if (labelText) {
                            entity.label = new Cesium.LabelGraphics({
                                text: String(labelText),
                                font: '14px Inter, sans-serif',
                                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                                fillColor: Cesium.Color.BLACK,
                                outlineColor: Cesium.Color.WHITE,
                                outlineWidth: 3,
                                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                                scaleByDistance: new Cesium.NearFarScalar(1.0e2, 1.0, 5.0e4, 0.0)
                            });

                            // Ensure position exists for Polygons (Calculate Center)
                            if (!entity.position && entity.polygon && entity.polygon.hierarchy) {
                                const hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
                                if (hierarchy && hierarchy.positions) {
                                    const center = Cesium.BoundingSphere.fromPoints(hierarchy.positions).center;
                                    entity.position = new Cesium.ConstantPositionProperty(center);
                                }
                            }
                        }
                    });
                    viewer.dataSources.add(ds);
                    geoJsonRefs.current.set(layer.id, ds);
                } catch (e) {
                    console.error('[useLayers] GeoJSON load error:', e);
                }
            }

            if (ds) {
                ds.show = layer.visible;
            }
        });
    }, [viewer, layers]);

    // 4. Manage 3D Tiles
    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        const tilesetLayers = layers.filter(l => l.type === LayerType.TILES_3D && l.url);
        const currentIds = new Set(tilesetLayers.map(l => l.id));

        // Remove old tilesets
        tilesetRefs.current.forEach((tileset, id) => {
            if (!currentIds.has(id)) {
                viewer.scene.primitives.remove(tileset);
                tilesetRefs.current.delete(id);
            }
        });

        // Add/update tilesets
        tilesetLayers.forEach(async (layer) => {
            let tileset = tilesetRefs.current.get(layer.id);

            if (!tileset) {
                try {
                    tileset = await Cesium.Cesium3DTileset.fromUrl(layer.url!, {
                        maximumScreenSpaceError: qualitySettings?.maximumScreenSpaceError ?? (isMobile ? 16 : 1)
                    });
                    viewer.scene.primitives.add(tileset);
                    tilesetRefs.current.set(layer.id, tileset);
                    await clampTilesetToGround(tileset, viewer);

                    // Apply initial transform if exists
                    const height = layer.heightOffset || 0;
                    const scale = layer.scale || 1.0;
                    if (height !== 0 || scale !== 1.0) {
                        applyTilesetTransform(tileset, height, scale);
                    }

                    // Click handler
                    if (onTilesetClick) {
                        // Simplified click handling for tileset
                        tileset.allTilesLoaded.addEventListener(() => {
                            // This event fires when all tiles are loaded, not for clicks.
                            // Actual click handling would involve picking.
                            // For now, we'll just log or trigger a generic callback.
                            // console.log(`Tileset ${layer.name} loaded`);
                            // onTilesetClick(layer.id); // This would be triggered by a pick event
                        });
                    }
                } catch (e) {
                    console.error('[useLayers] 3D Tileset load error:', e);
                }
            } else {
                // IMPORTANT: Update existing tileset if transform changed in parent state
                const height = layer.heightOffset || 0;
                const scale = layer.scale || 1.0;
                applyTilesetTransform(tileset, height, scale);
            }

            if (tileset) {
                tileset.show = layer.visible;
            }
        });

        // Expose global hook for real-time slider updates (from ProjectPanel)
        const win = window as any;
        win.__fixurelabsApplyTransform = (layerId: string, height: number, scale: number = 1.0) => {
            const ts = tilesetRefs.current.get(layerId);
            if (ts) {
                applyTilesetTransform(ts, height, scale);
            }
        };

        return () => {
            delete win.__fixurelabsApplyTransform;
        };
    }, [viewer, layers, isMobile, qualitySettings]);

    // Handle fly-to
    useEffect(() => {
        if (!flyToLayerId || !viewer || viewer.isDestroyed()) return;

        const kml = kmlRefs.current.get(flyToLayerId);
        const geojson = geoJsonRefs.current.get(flyToLayerId);
        const tileset = tilesetRefs.current.get(flyToLayerId);

        let flyTarget: any = null;

        if (kml) {
            flyTarget = kml;
        } else if (geojson) {
            flyToGeoJSON(geojson, viewer, isMobile);
            onFlyToComplete?.();
            return;
        } else if (tileset) {
            flyTarget = tileset;
        } else {
            // Check for Annotation (Measurement) Layers in direct entities
            const annotationEntities = viewer.entities.values.filter(e =>
                e.properties && e.properties.layerId && e.properties.layerId.getValue() === flyToLayerId
            );

            if (annotationEntities.length > 0) {
                flyTarget = annotationEntities;
            }
        }

        if (flyTarget) {
            if (isMobile && tileset) {
                viewer.zoomTo(flyTarget);
            } else {
                viewer.flyTo(flyTarget, { duration: 1.5 });
            }
            // Handshake: Notify that fly-to is executed so parent can clear the ID
            onFlyToComplete?.();
        }
    }, [flyToLayerId, viewer, isMobile, onFlyToComplete]);

    // Render function now returns null - layers are managed imperatively
    const renderLayers = useCallback(() => {
        // DXF/SHP layers that need primitive rendering would go here
        // For now, returning null as we handle everything imperatively
        return null;
    }, []);

    return { renderLayers };
}
