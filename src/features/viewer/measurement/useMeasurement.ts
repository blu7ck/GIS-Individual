
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
    sampleTerrainMostDetailed,
    Ellipsoid
} from 'cesium';
import { polygon, area, lineString, convex, points as turfPoints, length } from '@turf/turf';
import { MeasurementMode } from '../../../types';
import { MeasurementGeometry, MeasurementResult } from './measurementTypes';
import { formatDistance, formatArea, formatHeight, formatSlope } from './formatters';
import { isMobileDevice } from '../utils/performance';

interface UseMeasurementProps {
    viewer: Viewer | null;
    mode: MeasurementMode;
    onMeasurementResult: (result: MeasurementResult & { mode: MeasurementMode }) => void;
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
            if (points.length < 2) return 0;
            const ellipsoid = viewer?.scene.globe.ellipsoid || Ellipsoid.WGS84;
            const coords = points.map(p => {
                const c = Cartographic.fromCartesian(p, ellipsoid);
                return [CesiumMath.toDegrees(c.longitude), CesiumMath.toDegrees(c.latitude)];
            });
            const line = lineString(coords);
            return length(line, { units: 'meters' });
        };

        const calculateArea = () => {
            if (points.length < 3) return 0;
            const ellipsoid = viewer?.scene.globe.ellipsoid || Ellipsoid.WGS84;
            const coords = points.map(p => {
                const c = Cartographic.fromCartesian(p, ellipsoid);
                return [CesiumMath.toDegrees(c.longitude), CesiumMath.toDegrees(c.latitude)];
            });
            if (coords[0]) coords.push(coords[0]); // Close loop for Turf safely
            const poly = polygon([coords]);
            return area(poly);
        };

        if (mode === MeasurementMode.DISTANCE) {
            const dist = calculateDistance();
            setMeasurementText(formatDistance(dist));
        } else if (mode === MeasurementMode.AREA || mode === MeasurementMode.DRAW_POLYGON) {
            const area = calculateArea();
            setMeasurementText(formatArea(area));
        } else if (mode === MeasurementMode.SPOT_HEIGHT && lastPoint) {
            const ellipsoid = viewer?.scene.globe.ellipsoid;
            if (ellipsoid) {
                const carto = Cartographic.fromCartesian(lastPoint, ellipsoid);
                setMeasurementText(formatHeight(carto.height));
            }
        } else if (mode === MeasurementMode.SLOPE) {
            if (points.length >= 2) {
                const p1 = points[points.length - 2]!;
                const p2 = points[points.length - 1]!;
                const ellipsoid = viewer?.scene.globe.ellipsoid || Ellipsoid.WGS84;

                const c1 = Cartographic.fromCartesian(p1, ellipsoid);
                const c2 = Cartographic.fromCartesian(p2, ellipsoid);

                // Turf for horizontal run
                const dist = length(lineString([
                    [CesiumMath.toDegrees(c1.longitude), CesiumMath.toDegrees(c1.latitude)],
                    [CesiumMath.toDegrees(c2.longitude), CesiumMath.toDegrees(c2.latitude)]
                ]), { units: 'meters' });

                const rise = c2.height - c1.height;
                const percent = dist > 0 ? (Math.abs(rise) / dist) * 100 : 0;
                const degree = CesiumMath.toDegrees(Math.atan2(Math.abs(rise), dist));
                setMeasurementText(formatSlope(percent, degree));
            }
        } else if (mode === MeasurementMode.CONVEX_HULL) {
            if (points.length >= 3) {
                const ellipsoid = viewer?.scene.globe.ellipsoid;
                if (ellipsoid) {
                    const coords = points.map(p => {
                        const c = Cartographic.fromCartesian(p, ellipsoid);
                        return [CesiumMath.toDegrees(c.longitude), CesiumMath.toDegrees(c.latitude)];
                    });
                    try {
                        const hull = convex(turfPoints(coords));
                        if (hull && hull.geometry && hull.geometry.type === 'Polygon') {
                            const hullArea = area(hull);
                            setMeasurementText(`Zarf Alan: ${formatArea(hullArea).replace('Area: ', '')}`);
                        }
                    } catch (e) { }
                }
            }
        } else if (mode === MeasurementMode.LINE_OF_SIGHT && points.length >= 2) {
            const p1 = points[0]!;
            const p2 = points[1]!;
            const ellipsoid = viewer?.scene.globe.ellipsoid;
            if (ellipsoid) {
                const c1 = Cartographic.fromCartesian(p1, ellipsoid);
                const c2 = Cartographic.fromCartesian(p2, ellipsoid);
                const distVal = new EllipsoidGeodesic(c1, c2).surfaceDistance;
                setMeasurementText(`LOS: ${distVal.toFixed(1)}m (Analyzing...)`);

                // Async analysis for LOS
                const analyzeLOS = async () => {
                    const tp = viewer?.scene.terrainProvider;
                    if (!tp) return;

                    const samples = 20;
                    const points_to_sample = [];
                    for (let i = 0; i <= samples; i++) {
                        const lerp = i / samples;
                        const lon = CesiumMath.lerp(c1.longitude, c2.longitude, lerp);
                        const lat = CesiumMath.lerp(c1.latitude, c2.latitude, lerp);
                        points_to_sample.push(new Cartographic(lon, lat));
                    }

                    try {
                        const updated = await sampleTerrainMostDetailed(tp, points_to_sample);
                        let obstacleIndex = -1;
                        for (let i = 0; i < updated.length; i++) {
                            const point = updated[i];
                            if (point && typeof point.height === 'number') {
                                const lerp = i / samples;
                                const lineAlt = CesiumMath.lerp(c1.height, c2.height, lerp);
                                if (point.height > lineAlt + 0.1) {
                                    obstacleIndex = i;
                                    break;
                                }
                            }
                        }

                        if (obstacleIndex === -1) {
                            setMeasurementText(`LOS: ${distVal.toFixed(1)}m (Görünür)`);
                        } else {
                            setMeasurementText(`LOS: ${distVal.toFixed(1)}m (Engelli)`);
                        }
                    } catch (e) { }
                };
                analyzeLOS();
            }
        } else if (mode === MeasurementMode.VOLUME) {
            if (points.length >= 3) {
                const areaVal = calculateArea();
                const volume = areaVal * 5; // Simplified: 5m depth placeholder
                setMeasurementText(`Hacim: ${formatArea(areaVal).replace('Area: ', '')} | ~${volume.toFixed(0)}m³`);
            }
        } else if (mode === MeasurementMode.PROFILE) {
            if (points.length >= 2) {
                const dist = calculateDistance();
                setMeasurementText(`Kesit: ${formatDistance(dist).replace('Distance: ', '')}`);
            }
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
            } else if (mode === MeasurementMode.SPOT_HEIGHT && finalPoints[0]) {
                const c = Cartographic.fromCartesian(finalPoints[0], ellipsoid);
                text = formatHeight(c.height);
                geoData = {
                    type: 'Point',
                    points: [{ x: finalPoints[0].x, y: finalPoints[0].y, z: finalPoints[0].z }],
                    geojson: {
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [CesiumMath.toDegrees(c.longitude), CesiumMath.toDegrees(c.latitude)] },
                        properties: { height: c.height }
                    }
                };
            } else if (mode === MeasurementMode.SLOPE && finalPoints.length >= 2) {
                const p1 = finalPoints[0]!;
                const p2 = finalPoints[1]!;
                const c1 = Cartographic.fromCartesian(p1, ellipsoid);
                const c2 = Cartographic.fromCartesian(p2, ellipsoid);
                const runDist = length(lineString([
                    [CesiumMath.toDegrees(c1.longitude), CesiumMath.toDegrees(c1.latitude)],
                    [CesiumMath.toDegrees(c2.longitude), CesiumMath.toDegrees(c2.latitude)]
                ]), { units: 'meters' });
                const rise = c2.height - c1.height;
                const percent = runDist > 0 ? (Math.abs(rise) / runDist) * 100 : 0;
                const degree = CesiumMath.toDegrees(Math.atan2(Math.abs(rise), runDist));
                text = formatSlope(percent, degree);
                geoData = {
                    type: 'LineString',
                    points: finalPoints.map(p => ({ x: p.x, y: p.y, z: p.z })),
                    geojson: lineString(coords, { percent, degree, rise })
                };
            } else if (mode === MeasurementMode.CONVEX_HULL && finalPoints.length >= 3) {
                try {
                    const hull = convex(turfPoints(coords));
                    if (hull && hull.geometry && hull.geometry.type === 'Polygon') {
                        const hullArea = area(hull);
                        text = `Zarf Alan: ${formatArea(hullArea).replace('Area: ', '')}`;
                        geoData = {
                            type: 'Polygon',
                            points: finalPoints.map(p => ({ x: p.x, y: p.y, z: p.z })),
                            geojson: hull
                        };
                    }
                } catch (e) { }
            } else if (mode === MeasurementMode.LINE_OF_SIGHT && finalPoints.length >= 2) {
                const p1 = finalPoints[0]!;
                const p2 = finalPoints[1]!;
                const c1 = Cartographic.fromCartesian(p1, ellipsoid);
                const c2 = Cartographic.fromCartesian(p2, ellipsoid);
                const distVal = new EllipsoidGeodesic(c1, c2).surfaceDistance;
                text = `LOS: ${distVal.toFixed(1)}m`; // Will be updated by async if needed, or kept general
                geoData = {
                    type: 'LineString',
                    points: finalPoints.map(p => ({ x: p.x, y: p.y, z: p.z })),
                    geojson: lineString(coords, { distance: distVal })
                };
            } else if (mode === MeasurementMode.VOLUME && coords.length >= 3) {
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
                const volume = areaValue * 5;
                text = `Hacim: ${formatArea(areaValue).replace('Area: ', '')} | ~${volume.toFixed(0)}m³`;
                geoData = {
                    type: 'Polygon',
                    points: finalPoints.map(p => ({ x: p.x, y: p.y, z: p.z })),
                    geojson: poly
                };
            } else if (mode === MeasurementMode.PROFILE && finalPoints.length >= 2) {
                let dist = 0;
                for (let i = 0; i < finalPoints.length - 1; i++) {
                    const p1 = finalPoints[i];
                    const p2 = finalPoints[i + 1];
                    if (!p1 || !p2) continue;
                    const c1 = Cartographic.fromCartesian(p1, ellipsoid);
                    const c2 = Cartographic.fromCartesian(p2, ellipsoid);
                    dist += new EllipsoidGeodesic(c1, c2).surfaceDistance;
                }
                text = `Kesit: ${formatDistance(dist).replace('Distance: ', '')}`;
                const lineStringFeat = lineString(coords);
                geoData = {
                    type: 'Polyline',
                    points: finalPoints.map(p => ({ x: p.x, y: p.y, z: p.z })),
                    geojson: lineStringFeat
                };
            }

            if (text && geoData) {
                const finalGeoData = geoData; // for closure safety
                // Wrap in setTimeout to avoid "Cannot update a component while rendering a different component"
                setTimeout(() => {
                    onMeasurementResult({ text, geometry: finalGeoData, mode });
                }, 0);
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
        // Check if it's mobile AND NOT Windows (to avoid blocking laptop touch navigations)
        const isTrueMobile = isMobile && !navigator.userAgent.includes('Windows');

        if (isTrueMobile && controller) {
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
            if (!viewer || viewer.isDestroyed()) return;

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
                setPoints(prev => {
                    const newPoints = [...prev, p!];

                    // Auto-finish logic for specific modes
                    if (mode === MeasurementMode.SPOT_HEIGHT && newPoints.length >= 1) {
                        finishMeasurement(newPoints);
                        return [];
                    }
                    if ((mode === MeasurementMode.SLOPE || mode === MeasurementMode.LINE_OF_SIGHT) && newPoints.length >= 2) {
                        finishMeasurement(newPoints);
                        return [];
                    }

                    return newPoints;
                });

            } catch (e) { }

        }, ScreenSpaceEventType.LEFT_CLICK);

        let lastMoveTime = 0;
        handler.setInputAction(async (movement: any) => {
            if (!viewer || viewer.isDestroyed()) return;

            const now = Date.now();
            if (now - lastMoveTime < 16) return; // Throttle to ~60fps
            lastMoveTime = now;

            const p = getPick(movement.endPosition);
            if (p) {
                setTempPoint(p);
                viewer.scene.requestRender();
            }
        }, ScreenSpaceEventType.MOUSE_MOVE);

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
