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
    flyToUserLocation?: boolean;
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

    // Handle fly to user location
    useEffect(() => {
        if (!viewer || viewer.isDestroyed() || !flyToUserLocation || !userLocation) return;

        const destination = Cesium.Cartesian3.fromDegrees(
            userLocation.lng,
            userLocation.lat,
            1000 // altitude
        );

        viewer.camera.flyTo({
            destination: destination,
            duration: 2.0,
            complete: () => {
                onUserLocationFlyComplete?.();
            }
        });
    }, [viewer, flyToUserLocation, userLocation, onUserLocationFlyComplete]);

    return null; // This component renders imperatively
};
