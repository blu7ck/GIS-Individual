
import { useEffect, useMemo, useCallback } from 'react';
import { Viewer, Matrix4, Cartesian3, Ellipsoid, defined } from 'cesium';
import { AssetLayer, LayerType } from '../../../types';

interface UseTilesetTransformProps {
    viewer: Viewer | null;
    visibleLayers: AssetLayer[];
    tilesetRefs: React.MutableRefObject<Map<string, any>>;
}

export function useTilesetTransform({ viewer, visibleLayers, tilesetRefs }: UseTilesetTransformProps) {

    const applyTransformToTileset = useCallback((cesiumTileset: any, heightOffset: number, scale: number = 1.0) => {
        try {
            if (!cesiumTileset || cesiumTileset.isDestroyed()) return false;

            const hasRoot = !!cesiumTileset.root;
            const hasBoundingSphere = cesiumTileset.boundingSphere && defined(cesiumTileset.boundingSphere.center);

            if (!hasRoot && !hasBoundingSphere) return false;

            if (!cesiumTileset._hekamapOriginalCenter) {
                const boundingSphere = cesiumTileset.boundingSphere;
                if (boundingSphere && defined(boundingSphere.center)) {
                    cesiumTileset._hekamapOriginalCenter = Cartesian3.clone(boundingSphere.center);
                } else if (cesiumTileset.root && cesiumTileset.root.transform) {
                    cesiumTileset._hekamapOriginalCenter = Matrix4.getTranslation(cesiumTileset.root.transform, new Cartesian3());
                } else {
                    return false;
                }
            }
            const center = cesiumTileset._hekamapOriginalCenter;

            let scaleMatrix = Matrix4.IDENTITY;
            if (Math.abs(scale - 1.0) > 0.001) {
                const scaleM = Matrix4.fromUniformScale(scale, new Matrix4());
                const negCenter = Cartesian3.negate(center, new Cartesian3());
                const toOrigin = Matrix4.fromTranslation(negCenter, new Matrix4());
                const fromOrigin = Matrix4.fromTranslation(center, new Matrix4());
                const temp = Matrix4.multiply(scaleM, toOrigin, new Matrix4());
                scaleMatrix = Matrix4.multiply(fromOrigin, temp, new Matrix4());
            }

            let heightMatrix = Matrix4.IDENTITY;
            if (Math.abs(heightOffset) > 0.01) {
                const surfaceNormal = Ellipsoid.WGS84.geodeticSurfaceNormal(center, new Cartesian3());
                const offsetVector = Cartesian3.multiplyByScalar(surfaceNormal, heightOffset, new Cartesian3());
                heightMatrix = Matrix4.fromTranslation(offsetVector, new Matrix4());
            }

            const finalModelMatrix = Matrix4.multiply(heightMatrix, scaleMatrix, new Matrix4());

            // Combine with base transform if exists (ground clamp)
            if (cesiumTileset._hekamapBaseTransform) {
                Matrix4.multiply(cesiumTileset._hekamapBaseTransform, finalModelMatrix, finalModelMatrix);
            }

            if (!cesiumTileset.isDestroyed()) {
                // Mobile/Desktop split handling for apply
                if (cesiumTileset._hekamapIsMobile) {
                    cesiumTileset.modelMatrix = finalModelMatrix;
                } else {
                    if (cesiumTileset.root) {
                        // If desktop and clamped, typically we modify root.transform. 
                        // This logic assumes we update the *current* transform which is base * calc.
                        // Actually existing code logic replaces root.transform or modelMatrix.
                        cesiumTileset.root.transform = finalModelMatrix;
                    } else {
                        cesiumTileset.modelMatrix = finalModelMatrix;
                    }
                }

                const v = viewer;
                if (v && !v.isDestroyed()) v.scene.requestRender();
                return true;
            }
            return false;

        } catch (e) { return false; }
    }, [viewer]);

    // Real-time updates effect
    const transformKey = useMemo(() => {
        return visibleLayers
            .filter(l => l.type === LayerType.TILES_3D)
            .map(l => `${l.id}:${l.heightOffset ?? 0}:${l.scale ?? 1}`)
            .join('|');
    }, [visibleLayers]);

    useEffect(() => {
        const timeouts: Array<ReturnType<typeof setTimeout>> = [];

        visibleLayers.forEach(layer => {
            if (layer.type === LayerType.TILES_3D) {
                const tileset = tilesetRefs.current.get(layer.id);
                if (tileset?.cesiumElement) {
                    const apply = (retry = 0) => {
                        try {
                            const success = applyTransformToTileset(tileset.cesiumElement, layer.heightOffset || 0, layer.scale ?? 1);
                            if (!success && retry < 30) {
                                timeouts.push(setTimeout(() => apply(retry + 1), 10));
                            }
                        } catch (e) {
                            if (retry < 5) timeouts.push(setTimeout(() => apply(retry + 1), 50));
                        }
                    };
                    apply();
                }
            }
        });

        return () => timeouts.forEach(clearTimeout);
    }, [transformKey, applyTransformToTileset, visibleLayers]);

    // Expose global for slider
    useEffect(() => {
        const applyGlobal = (layerId: string, h: number, s: number = 1.0) => {
            const tileset = tilesetRefs.current.get(layerId);
            if (tileset?.cesiumElement) {
                applyTransformToTileset(tileset.cesiumElement, h, s);
            }
        };

        (window as any).__hekamapApplyTransform = applyGlobal;
        return () => { delete (window as any).__hekamapApplyTransform; };
    }, [applyTransformToTileset]);
}
