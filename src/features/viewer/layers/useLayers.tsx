import { useEffect, useMemo, useCallback } from 'react';
import * as Cesium from 'cesium';
import { AssetLayer, LayerType, QualitySettings } from '../../../../types';
import { isMobileDevice } from '../utils/performance';
import { adjustKmlHeights } from './kml';
import { clampTilesetToGround } from './tileset';
import { flyToGeoJSON } from './geojson';

interface UseLayersProps {
    viewer: Cesium.Viewer | null;
    layers: AssetLayer[];
    flyToLayerId: string | null;
    qualitySettings: QualitySettings | null;
    onTilesetClick?: (layerId: string) => void;
    tilesetRefs: React.MutableRefObject<Map<string, Cesium.Cesium3DTileset>>;
    kmlRefs: React.MutableRefObject<Map<string, Cesium.KmlDataSource>>;
    geoJsonRefs: React.MutableRefObject<Map<string, Cesium.GeoJsonDataSource>>;
}

export function useLayers({ viewer, layers, flyToLayerId, onTilesetClick, tilesetRefs, kmlRefs, geoJsonRefs }: UseLayersProps) {

    const isMobile = useMemo(() => isMobileDevice(), []);

    // Manage KML layers
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

    // Manage GeoJSON layers
    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        const geojsonLayers = layers.filter(l => l.type === LayerType.SHP && l.data?.type === "FeatureCollection");
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
                        clampToGround: true,
                        stroke: Cesium.Color.YELLOW,
                        fill: Cesium.Color.YELLOW.withAlpha(0.5),
                        strokeWidth: 3
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

    // Manage 3D Tiles
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
                        maximumScreenSpaceError: isMobile ? 16 : 1
                    });
                    viewer.scene.primitives.add(tileset);
                    tilesetRefs.current.set(layer.id, tileset);
                    clampTilesetToGround(tileset, viewer);

                    // Click handler
                    if (onTilesetClick) {
                        // Note: Click handling for 3D tiles requires ScreenSpaceEventHandler
                        // This is a simplified approach - for full click support, we need scene picking
                    }
                } catch (e) {
                    console.error('[useLayers] 3D Tileset load error:', e);
                }
            }

            if (tileset) {
                tileset.show = layer.visible;
            }
        });
    }, [viewer, layers, isMobile, onTilesetClick]);

    // Handle fly-to
    useEffect(() => {
        if (!flyToLayerId || !viewer || viewer.isDestroyed()) return;

        const kml = kmlRefs.current.get(flyToLayerId);
        const geojson = geoJsonRefs.current.get(flyToLayerId);
        const tileset = tilesetRefs.current.get(flyToLayerId);

        if (kml) {
            viewer.flyTo(kml, { duration: 1.5 });
        } else if (geojson) {
            flyToGeoJSON(geojson, viewer, isMobile);
        } else if (tileset) {
            if (isMobile) {
                viewer.zoomTo(tileset);
            } else {
                viewer.flyTo(tileset, { duration: 2.0 });
            }
        }
    }, [flyToLayerId, viewer, isMobile]);

    // Render function now returns null - layers are managed imperatively
    const renderLayers = useCallback(() => {
        // DXF/SHP layers that need primitive rendering would go here
        // For now, returning null as we handle everything imperatively
        return null;
    }, []);

    return { renderLayers };
}
