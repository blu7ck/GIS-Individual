
import {
    Cartesian3,
    JulianDate,
    defined,
    KmlDataSource,
    Viewer,
    EllipsoidTerrainProvider,
    PolygonHierarchy,
    ConstantProperty,
    HeightReference,
    Cartographic
} from 'cesium';

/**
 * Extract all positions from KML entity (all geometry types)
 * Supports Point, Polygon, Polyline, and Model entities
 */
export function extractPositionsFromKmlEntity(entity: any, time: JulianDate): Cartesian3[] {
    const positions: Cartesian3[] = [];

    try {
        // 1. Point entity: position property
        if (entity.position && defined(entity.position)) {
            const pos = entity.position.getValue ? entity.position.getValue(time) : entity.position;
            if (pos && defined(pos)) {
                positions.push(pos);
            }
        }

        // 2. Polygon entity: polygon.hierarchy
        if (entity.polygon && entity.polygon.hierarchy) {
            const hierarchy = entity.polygon.hierarchy.getValue
                ? entity.polygon.hierarchy.getValue(time)
                : entity.polygon.hierarchy;

            if (hierarchy && hierarchy.positions) {
                hierarchy.positions.forEach((pos: Cartesian3) => {
                    if (pos && defined(pos)) {
                        positions.push(pos);
                    }
                });
            }
        }

        // 3. Polyline entity: polyline.positions
        if (entity.polyline && entity.polyline.positions) {
            const polylinePositions = entity.polyline.positions.getValue
                ? entity.polyline.positions.getValue(time)
                : entity.polyline.positions;

            if (polylinePositions && Array.isArray(polylinePositions)) {
                polylinePositions.forEach((pos: Cartesian3) => {
                    if (pos && defined(pos)) {
                        positions.push(pos);
                    }
                });
            }
        }

        // 4. Model entity: position
        if (entity.model && entity.position) {
            const pos = entity.position.getValue ? entity.position.getValue(time) : entity.position;
            if (pos && defined(pos)) {
                positions.push(pos);
            }
        }
    } catch (err) {
        // Silently skip entities that cause errors
    }

    return positions;
}

/**
 * Fix KML features being buried underground by adjusting entity heights
 * Process entities after KML datasource is fully loaded
 * Uses terrain sampling for accurate height adjustment
 */
export async function adjustKmlHeights(datasource: KmlDataSource, viewer: Viewer): Promise<void> {
    if (!datasource.entities) return;
    if (!viewer || viewer.isDestroyed()) return;

    const scene = viewer.scene;
    if (!scene || scene.isDestroyed()) return;

    const terrainProvider = scene.terrainProvider;

    if (!terrainProvider || terrainProvider instanceof EllipsoidTerrainProvider) {
        // No terrain data available, use minimum height offset
        adjustKmlHeightsWithoutTerrain(datasource);
    } else {
        // Terrain available, drape on ground
        adjustKmlHeightsWithTerrain(datasource);
    }
}

function adjustKmlHeightsWithoutTerrain(datasource: KmlDataSource) {
    const time = JulianDate.now();
    const MIN_HEIGHT = 2.0;

    datasource.entities.values.forEach((entity: any) => {
        try {
            const entityPositions = extractPositionsFromKmlEntity(entity, time);
            if (entityPositions.length === 0) return;

            // Simple height adjustment without terrain sampling
            if (entity.polygon && entity.polygon.hierarchy) {
                const hierarchy = entity.polygon.hierarchy.getValue
                    ? entity.polygon.hierarchy.getValue(time)
                    : entity.polygon.hierarchy;

                if (hierarchy && hierarchy.positions) {
                    const adjustedPositions = hierarchy.positions.map((pos: Cartesian3) => {
                        const cart = Cartographic.fromCartesian(pos);
                        if (cart.height < MIN_HEIGHT) {
                            return Cartesian3.fromRadians(
                                cart.longitude,
                                cart.latitude,
                                MIN_HEIGHT
                            );
                        }
                        return pos;
                    });

                    entity.polygon.hierarchy = new ConstantProperty(
                        new PolygonHierarchy(adjustedPositions)
                    );
                }
            } else if (entity.polyline && entity.polyline.positions) {
                const polylinePositions = entity.polyline.positions.getValue
                    ? entity.polyline.positions.getValue(time)
                    : entity.polyline.positions;

                if (polylinePositions && Array.isArray(polylinePositions)) {
                    const adjustedPositions = polylinePositions.map((pos: Cartesian3) => {
                        const cart = Cartographic.fromCartesian(pos);
                        if (cart.height < MIN_HEIGHT) {
                            return Cartesian3.fromRadians(
                                cart.longitude,
                                cart.latitude,
                                MIN_HEIGHT
                            );
                        }
                        return pos;
                    });

                    entity.polyline.positions = new ConstantProperty(adjustedPositions);
                }
            } else if (entity.position) {
                const pos = entityPositions[0];
                if (pos) {
                    const cart = Cartographic.fromCartesian(pos);
                    if (cart.height < MIN_HEIGHT) {
                        const newPos = Cartesian3.fromRadians(
                            cart.longitude,
                            cart.latitude,
                            MIN_HEIGHT
                        );

                        if (entity.position.setValue) {
                            entity.position.setValue(newPos);
                        }
                    }
                }
            }
        } catch (e) {
            // Skip entities that can't be processed
        }
    });
}

function adjustKmlHeightsWithTerrain(datasource: KmlDataSource) {
    try {
        // Process entities: Set heightReference for terrain draping
        for (const entity of datasource.entities.values) {
            try {
                // For polygons: Set to clamp to ground
                if (entity.polygon) {
                    // Drape polygon on terrain
                    entity.polygon.perPositionHeight = new ConstantProperty(false);
                    entity.polygon.heightReference = new ConstantProperty(HeightReference.CLAMP_TO_GROUND);
                    // Ensure height is not undefined to avoid heightReference warnings
                    if (!entity.polygon.height) {
                        entity.polygon.height = new ConstantProperty(0);
                    }
                }

                // For polylines: Set clamp to ground
                if (entity.polyline) {
                    entity.polyline.clampToGround = new ConstantProperty(true);
                    // CRITICAL: When clampToGround is true, arcType must be GEODESIC or RHUMB
                    // Defaulting to GEODESIC to avoid DeveloperError: Valid options for arcType are ArcType.GEODESIC and ArcType.RHUMB
                    (entity.polyline as any).arcType = new ConstantProperty(2); // 2 is Cesium.ArcType.GEODESIC (avoid direct enum access if possible in this context but let's be safe)
                }

                // For points/billboards: Set relative to ground with vertical offset
                if (entity.billboard) {
                    entity.billboard.heightReference = new ConstantProperty(HeightReference.RELATIVE_TO_GROUND);
                    entity.billboard.eyeOffset = new ConstantProperty(new Cartesian3(0, 0, -15)); // Lift 15m above
                    entity.billboard.disableDepthTestDistance = new ConstantProperty(Number.POSITIVE_INFINITY);
                }

                if (entity.point) {
                    entity.point.heightReference = new ConstantProperty(HeightReference.RELATIVE_TO_GROUND);
                    entity.point.disableDepthTestDistance = new ConstantProperty(Number.POSITIVE_INFINITY);
                }

                if (entity.label) {
                    entity.label.heightReference = new ConstantProperty(HeightReference.RELATIVE_TO_GROUND);
                    entity.label.eyeOffset = new ConstantProperty(new Cartesian3(0, 0, -20)); // Lift 20m above
                    entity.label.disableDepthTestDistance = new ConstantProperty(Number.POSITIVE_INFINITY);
                }
            } catch (e) {
                // Skip entities that can't be processed
            }
        }
    } catch (e) {
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
            console.debug('Error adjusting KML heights:', e);
        }
    }
}
