
import {
    Viewer,
    Cartographic,
    Cartesian3,
    BoundingSphere,
    JulianDate,
    HeadingPitchRange,
    Math as CesiumMath,
    defined,
    GeoJsonDataSource
} from 'cesium';

/**
 * Fly to GeoJSON DataSource extent
 */
export async function flyToGeoJSON(
    ds: GeoJsonDataSource,
    viewer: Viewer,
    isMobile: boolean
): Promise<void> {
    try {
        const dataSource = ds as any;
        if (viewer.isDestroyed() || (dataSource.isDestroyed && dataSource.isDestroyed())) return;

        // Modern Cesium relies on loading events or readiness elsewhere
        // Removed deprecated loadedPromise check

        // Simple timeout to ensure entities ready
        await new Promise(resolve => setTimeout(resolve, isMobile ? 500 : 200));

        let boundingSphere = dataSource.boundingSphere;

        // Compute if missing
        if (!boundingSphere && ds.entities && ds.entities.values.length > 0) {
            const allPositions: Cartesian3[] = [];
            const time = JulianDate.now();

            ds.entities.values.forEach((entity: any) => {
                if (entity.position) {
                    const pos = entity.position.getValue(time);
                    if (pos) allPositions.push(pos);
                }
                // Add polyline/polygon positions extraction logic if needed for precise bounds
            });

            if (allPositions.length > 0) {
                boundingSphere = BoundingSphere.fromPoints(allPositions);
            }
        }

        if (boundingSphere && defined(boundingSphere)) {
            if (isMobile) {
                // Instant jump for mobile stability
                try {
                    const center = boundingSphere.center;
                    const cartTemplates = Cartographic.fromCartesian(center);
                    viewer.camera.setView({
                        destination: Cartesian3.fromRadians(
                            cartTemplates.longitude,
                            cartTemplates.latitude,
                            cartTemplates.height + boundingSphere.radius * 2
                        ),
                        orientation: {
                            heading: 0,
                            pitch: CesiumMath.toRadians(-45),
                            roll: 0
                        }
                    });
                } catch (e) { }
            } else {
                viewer.camera.flyToBoundingSphere(boundingSphere, {
                    duration: 1.5,
                    offset: new HeadingPitchRange(0, -0.5, boundingSphere.radius * 2)
                });
            }
        } else {
            // Fallback to flyTo(ds)
            viewer.flyTo(ds, { duration: 1.5 });
        }

    } catch (error) {
        // console.warn('FlyTo GeoJSON failed', error);
    }
}
