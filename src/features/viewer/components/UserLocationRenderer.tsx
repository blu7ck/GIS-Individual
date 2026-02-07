import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

interface UserLocation {
    lat: number;
    lng: number;
    accuracy: number;
    heading?: number | null;
}

interface UserLocationRendererProps {
    viewer: Cesium.Viewer | null;
    userLocation: UserLocation | null;
    showUserLocation: boolean;
    flyToUserLocation?: number;
    onUserLocationFlyComplete?: () => void;
}

export const UserLocationRenderer: React.FC<UserLocationRendererProps> = ({
    viewer,
    userLocation,
    showUserLocation,
    flyToUserLocation,
    onUserLocationFlyComplete
}) => {
    const locationEntityRef = useRef<Cesium.Entity | null>(null);
    const accuracyEntityRef = useRef<Cesium.Entity | null>(null);

    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) return;

        // Cleanup old entities
        if (locationEntityRef.current) {
            viewer.entities.remove(locationEntityRef.current);
            locationEntityRef.current = null;
        }
        if (accuracyEntityRef.current) {
            viewer.entities.remove(accuracyEntityRef.current);
            accuracyEntityRef.current = null;
        }

        if (!showUserLocation || !userLocation) return;

        const position = Cesium.Cartesian3.fromDegrees(userLocation.lng, userLocation.lat);

        // User location point
        locationEntityRef.current = viewer.entities.add({
            position: position,
            point: {
                pixelSize: 12,
                color: Cesium.Color.DODGERBLUE,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 3,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });

        // Accuracy circle (approximation using ellipse)
        if (userLocation.accuracy > 0) {
            accuracyEntityRef.current = viewer.entities.add({
                position: position,
                ellipse: {
                    semiMajorAxis: userLocation.accuracy,
                    semiMinorAxis: userLocation.accuracy,
                    material: Cesium.Color.DODGERBLUE.withAlpha(0.2),
                    outline: true,
                    outlineColor: Cesium.Color.DODGERBLUE.withAlpha(0.5),
                    height: 0,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                }
            });
        }

        return () => {
            if (viewer && !viewer.isDestroyed()) {
                if (locationEntityRef.current) viewer.entities.remove(locationEntityRef.current);
                if (accuracyEntityRef.current) viewer.entities.remove(accuracyEntityRef.current);
            }
        };
    }, [viewer, userLocation, showUserLocation]);

    // Handle Fly To Request
    useEffect(() => {
        if (flyToUserLocation && flyToUserLocation > 0 && userLocation && viewer && !viewer.isDestroyed()) {
            try {
                const position = Cesium.Cartesian3.fromDegrees(
                    userLocation.lng,
                    userLocation.lat,
                    1000 // Default height
                );

                viewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(
                        userLocation.lng,
                        userLocation.lat, // Use 2D view by looking down
                        2500 // Height in meters
                    ),
                    orientation: {
                        heading: Cesium.Math.toRadians(0),
                        pitch: Cesium.Math.toRadians(-90),
                        roll: 0.0
                    },
                    duration: 1.5,
                    complete: () => {
                        if (onUserLocationFlyComplete) onUserLocationFlyComplete();
                    }
                });
            } catch (error) {
                console.error('Error flying to user location:', error);
            }
        }
    }, [flyToUserLocation, userLocation, viewer, onUserLocationFlyComplete]);

    return null;
    // This component renders imperatively
};
