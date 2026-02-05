
import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Viewer,
    Cartesian3,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Cartographic,
    EllipsoidGeodesic,
    Math as CesiumMath,
    Cartesian2,
    EllipsoidTerrainProvider,
    sampleTerrainMostDetailed
} from 'cesium';
import { polygon, area, lineString } from '@turf/turf';
import { MeasurementMode } from '../../../../types';
import { MeasurementGeometry, MeasurementResult } from './measurementTypes';
import { formatDistance, formatArea } from './formatters';
import { isMobileDevice } from '../utils/performance';

interface UseMeasurementProps {
    viewer: Viewer | null;
    mode: MeasurementMode;
    onMeasurementResult: (result: MeasurementResult) => void;
}

export function useMeasurement({ viewer, mode, onMeasurementResult }: UseMeasurementProps) {
    const [points, setPoints] = useState<Cartesian3[]>([]);
    const [tempPoint, setTempPoint] = useState<Cartesian3 | null>(null);
    const [measurementText, setMeasurementText] = useState<string>("");
    const [measurementPosition, setMeasurementPosition] = useState<Cartesian3 | null>(null);

    const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
    const lastClickTimeRef = useRef<number>(0);
    const lastClickPositionRef = useRef<Cartesian2 | null>(null);

    // Clear state when mode changes
    useEffect(() => {
        setPoints([]);
        setTempPoint(null);
        setMeasurementText("");
        setMeasurementPosition(null);
    }, [mode]);

    // Calculations
    useEffect(() => {
        if (points.length === 0) {
            setMeasurementText("");
            setMeasurementPosition(null);
            return;
        }

        // Update position to last point
        const lastPoint = points[points.length - 1];
        if (lastPoint) {
            setMeasurementPosition(lastPoint);
        }

        const calculateDistance = () => {
            let dist = 0;
            const ellipsoid = viewer?.scene.globe.ellipsoid;
            if (!ellipsoid) return 0;

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                if (!p1 || !p2) continue;

                const c1 = Cartographic.fromCartesian(p1, ellipsoid);
                const c2 = Cartographic.fromCartesian(p2, ellipsoid);
                const geodesic = new EllipsoidGeodesic(c1, c2);
                dist += geodesic.surfaceDistance;
            }
            return dist;
        };

        const calculateArea = () => {
            if (points.length < 3) return 0;
            const ellipsoid = viewer?.scene.globe.ellipsoid;
            if (!ellipsoid) return 0;

            const coords = points.map(p => {
                const c = Cartographic.fromCartesian(p, ellipsoid);
                return [
                    CesiumMath.toDegrees(c.longitude),
                    CesiumMath.toDegrees(c.latitude)
                ];
            });

            // Close the loop
            if (coords.length > 0) {
                const first = coords[0]!;
                const last = coords[coords.length - 1]!;
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    coords.push(first);
                }
            }

            try {
                const poly = polygon([coords]);
                return area(poly);
            } catch (e) {
                return 0;
            }
        };

        if (mode === MeasurementMode.DISTANCE) {
            const dist = calculateDistance();
            setMeasurementText(formatDistance(dist));
        } else if (mode === MeasurementMode.AREA || mode === MeasurementMode.DRAW_POLYGON) {
            const area = calculateArea();
            setMeasurementText(formatArea(area));
        }
    }, [points, mode, viewer]);

    // Finish measurement helper
    const finishMeasurement = useCallback((finalPoints: Cartesian3[]) => {
        if (!viewer) return;
        const ellipsoid = viewer.scene.globe.ellipsoid;
        let text = "";
        let geoData: MeasurementGeometry | null = null;

        try {
            const coords = finalPoints.map(p => {
                const c = Cartographic.fromCartesian(p, ellipsoid);
                return [CesiumMath.toDegrees(c.longitude), CesiumMath.toDegrees(c.latitude)];
            });

            if (mode === MeasurementMode.DISTANCE) {
                let dist = 0;
                for (let i = 0; i < finalPoints.length - 1; i++) {
                    const p1 = finalPoints[i];
                    const p2 = finalPoints[i + 1];
                    if (!p1 || !p2) continue;

                    const c1 = Cartographic.fromCartesian(p1, ellipsoid);
                    const c2 = Cartographic.fromCartesian(p2, ellipsoid);
                    const g = new EllipsoidGeodesic(c1, c2);
                    dist += g.surfaceDistance;
                }
                text = formatDistance(dist);

                const lineStringFeat = lineString(coords);
                geoData = {
                    type: 'Polyline',
                    points: finalPoints.map(p => ({ x: p.x, y: p.y, z: p.z })),
                    geojson: lineStringFeat
                };

            } else if (mode === MeasurementMode.AREA || mode === MeasurementMode.DRAW_POLYGON) {
                // Close loop
                if (coords.length > 0) {
                    const firstCoord = coords[0]!;
                    const lastCoord = coords[coords.length - 1]!;
                    if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
                        coords.push(firstCoord);
                    }
                }
                const poly = polygon([coords]);
                const areaValue = area(poly);
                text = formatArea(areaValue);

                geoData = {
                    type: 'Polygon',
                    points: finalPoints.map(p => ({ x: p.x, y: p.y, z: p.z })),
                    geojson: poly
                };
            }

            if (text && geoData) {
                onMeasurementResult({ text, geometry: geoData });
            }
        } catch (e) {
            // console.error("Measurement finish error", e);
        }

        setPoints([]);
        setTempPoint(null);
        setMeasurementText("");
        setMeasurementPosition(null);

    }, [viewer, mode, onMeasurementResult]);

    // Interaction Logic
    useEffect(() => {
        if (!viewer || viewer.isDestroyed() || mode === MeasurementMode.NONE) return;

        const scene = viewer.scene;
        if (!scene || scene.isDestroyed()) return;

        if (handlerRef.current) {
            if (!handlerRef.current.isDestroyed()) handlerRef.current.destroy();
            handlerRef.current = null;
        }

        const handler = new ScreenSpaceEventHandler(scene.canvas);
        handlerRef.current = handler;
        const isMobile = isMobileDevice();

        // Setup input controller options if mobile
        const controller = scene.screenSpaceCameraController;
        if (isMobile && controller) {
            // Disable panning mechanisms to allow picking
            controller.enableTranslate = false;
            controller.enableRotate = false;
            controller.enableTilt = false;
            controller.enableLook = false;
            controller.enableZoom = true; // allow pinch zoom
        }

        // Pick function
        const getPick = (pos: Cartesian2): Cartesian3 | undefined => {
            try {
                if (viewer.isDestroyed()) return undefined;

                if (isMobile) {
                    // Fast pick for mobile
                    try {
                        const picked = scene.pickPosition(pos);
                        if (picked) return picked;
                    } catch (e) { }

                    try {
                        const ray = viewer.camera.getPickRay(pos);
                        if (ray) return scene.globe.pick(ray, scene) || undefined;
                    } catch (e) { }

                    return viewer.camera.pickEllipsoid(pos, scene.globe.ellipsoid) || undefined;
                } else {
                    // Desktop precise pick
                    const picked = scene.pickPosition(pos);
                    if (picked) return picked;
                    return viewer.camera.pickEllipsoid(pos, scene.globe.ellipsoid) || undefined;
                }
            } catch (e) { return undefined; }
        };

        const correctPickHeight = async (pos: Cartesian3): Promise<Cartesian3> => {
            if (isMobile) return pos; // Skip on mobile

            try {
                if (viewer.isDestroyed()) return pos;
                const tp = scene.terrainProvider;
                if (!tp || tp instanceof EllipsoidTerrainProvider) return pos;

                const c = Cartographic.fromCartesian(pos);
                const updated = await sampleTerrainMostDetailed(tp, [c]);
                if (updated && updated[0] && updated[0].height !== undefined) {
                    return Cartesian3.fromRadians(c.longitude, c.latitude, updated[0].height + 0.5);
                }
            } catch (e) { }
            return pos;
        };

        handler.setInputAction(async (click: any) => {
            if (viewer.isDestroyed()) return;

            try {
                let p = getPick(click.position);
                if (!p) return;

                if (!isMobile) {
                    p = await correctPickHeight(p);
                }

                // Mobile Double Tap
                if (isMobile) {
                    const now = Date.now();
                    const delta = now - lastClickTimeRef.current;

                    if (lastClickPositionRef.current && delta < 300 && delta > 0) {
                        const dist = Cartesian2.distance(click.position, lastClickPositionRef.current);
                        if (dist < 20) {
                            // Double tap -> finish
                            setPoints(prev => {
                                // Add current p then finish
                                const allCurrent = [...prev, p!];
                                const min = mode === MeasurementMode.DISTANCE ? 2 : 3;
                                if (allCurrent.length >= min) {
                                    finishMeasurement(allCurrent);
                                    return [];
                                }
                                return allCurrent;
                            });
                            lastClickTimeRef.current = 0;
                            return;
                        }
                    }
                    lastClickTimeRef.current = now;
                    lastClickPositionRef.current = Cartesian2.clone(click.position);
                }

                // Add point
                setPoints(prev => [...prev, p!]);

            } catch (e) { }

        }, ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction(() => {
            setPoints(current => {
                if (current.length >= 2) finishMeasurement(current);
                return [];
            });
        }, ScreenSpaceEventType.RIGHT_CLICK);

        return () => {
            if (handlerRef.current && !handlerRef.current.isDestroyed()) {
                handlerRef.current.destroy();
            }
            handlerRef.current = null;

            // Restore camera controls
            if (isMobile && controller && !viewer.isDestroyed()) {
                controller.enableTranslate = true;
                controller.enableRotate = true;
                controller.enableTilt = true;
                controller.enableLook = true;
                controller.enableZoom = true;
            }
        };
    }, [viewer, mode, finishMeasurement]);

    return {
        points,
        tempPoint,
        measurementText,
        measurementPosition,
        clearMeasurement: useCallback(() => {
            setPoints([]);
            setTempPoint(null);
            setMeasurementText("");
            setMeasurementPosition(null);
        }, []),
        finishCurrentMeasurement: useCallback(() => {
            finishMeasurement(points);
        }, [finishMeasurement, points])
    };
}
