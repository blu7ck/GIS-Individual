import { useState, useEffect, useCallback, useRef } from 'react';

export interface GeolocationPosition {
    lat: number;
    lng: number;
    accuracy: number; // metres
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null; // degrees from north
    speed: number | null; // m/s
    timestamp: number;
}

export interface GeolocationState {
    position: GeolocationPosition | null;
    error: GeolocationError | null;
    isLoading: boolean;
    isTracking: boolean;
    isSupported: boolean;
    permissionState: PermissionState | null;
}

export interface GeolocationError {
    code: number;
    message: string;
    type: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED';
}

export interface UseGeolocationOptions {
    enableHighAccuracy?: boolean;
    maximumAge?: number;
    timeout?: number;
}

const defaultOptions: UseGeolocationOptions = {
    enableHighAccuracy: true,
    maximumAge: 2000, // Accept positions up to 2 seconds old
    timeout: 10000, // 10 second timeout
};

export function useGeolocation(options: UseGeolocationOptions = {}) {
    const mergedOptions = { ...defaultOptions, ...options };

    const [state, setState] = useState<GeolocationState>({
        position: null,
        error: null,
        isLoading: false,
        isTracking: false,
        isSupported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
        permissionState: null,
    });

    const watchIdRef = useRef<number | null>(null);
    const isMountedRef = useRef(true);

    // Check permission state on mount
    useEffect(() => {
        if (!state.isSupported) return;

        const checkPermission = async () => {
            try {
                if ('permissions' in navigator) {
                    const permission = await navigator.permissions.query({ name: 'geolocation' });
                    if (isMountedRef.current) {
                        setState(prev => ({ ...prev, permissionState: permission.state }));

                        // Listen for permission changes
                        permission.onchange = () => {
                            if (isMountedRef.current) {
                                setState(prev => ({ ...prev, permissionState: permission.state }));
                            }
                        };
                    }
                }
            } catch (e) {
                // Permission API not supported, continue without it
            }
        };

        checkPermission();

        return () => {
            isMountedRef.current = false;
        };
    }, [state.isSupported]);

    // Convert GeolocationPositionError to our error type
    const handleError = useCallback((error: GeolocationPositionError): GeolocationError => {
        const errorTypes: Record<number, GeolocationError['type']> = {
            1: 'PERMISSION_DENIED',
            2: 'POSITION_UNAVAILABLE',
            3: 'TIMEOUT',
        };

        const messages: Record<number, string> = {
            1: 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından konum iznini etkinleştirin.',
            2: 'Konum bilgisi alınamadı. GPS sinyali mevcut olmayabilir.',
            3: 'Konum isteği zaman aşımına uğradı. Lütfen tekrar deneyin.',
        };

        return {
            code: error.code,
            message: messages[error.code] || error.message,
            type: errorTypes[error.code] || 'POSITION_UNAVAILABLE',
        };
    }, []);

    // Convert native GeolocationPosition to our position type
    const handleSuccess = useCallback((position: globalThis.GeolocationPosition): void => {
        if (!isMountedRef.current) return;

        const coords = position.coords;
        const newPosition: GeolocationPosition = {
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy,
            altitude: coords.altitude,
            altitudeAccuracy: coords.altitudeAccuracy,
            heading: coords.heading,
            speed: coords.speed,
            timestamp: position.timestamp,
        };

        setState(prev => ({
            ...prev,
            position: newPosition,
            error: null,
            isLoading: false,
        }));
    }, []);

    // Get current position (one-time)
    const getCurrentPosition = useCallback(() => {
        console.log('[Geolocation] getCurrentPosition called, isSupported:', state.isSupported);

        if (!state.isSupported) {
            console.error('[Geolocation] Geolocation API not supported');
            setState(prev => ({
                ...prev,
                error: {
                    code: 0,
                    message: 'Geolocation bu tarayıcıda desteklenmiyor.',
                    type: 'NOT_SUPPORTED',
                },
            }));
            return;
        }

        console.log('[Geolocation] Requesting current position with options:', mergedOptions);
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                console.log('[Geolocation] Position received:', pos.coords.latitude, pos.coords.longitude, 'accuracy:', pos.coords.accuracy);
                handleSuccess(pos);
            },
            (err) => {
                console.error('[Geolocation] Error:', err.code, err.message);
                if (isMountedRef.current) {
                    setState(prev => ({
                        ...prev,
                        error: handleError(err),
                        isLoading: false,
                    }));
                }
            },
            mergedOptions
        );
    }, [state.isSupported, mergedOptions, handleSuccess, handleError]);

    // Start tracking position
    const startTracking = useCallback(() => {
        console.log('[Geolocation] startTracking called, isSupported:', state.isSupported);

        if (!state.isSupported) {
            console.error('[Geolocation] Geolocation API not supported');
            setState(prev => ({
                ...prev,
                error: {
                    code: 0,
                    message: 'Geolocation bu tarayıcıda desteklenmiyor.',
                    type: 'NOT_SUPPORTED',
                },
            }));
            return;
        }

        // Clear any existing watch
        if (watchIdRef.current !== null) {
            console.log('[Geolocation] Clearing existing watch:', watchIdRef.current);
            navigator.geolocation.clearWatch(watchIdRef.current);
        }

        console.log('[Geolocation] Starting watchPosition with options:', mergedOptions);
        setState(prev => ({ ...prev, isLoading: true, isTracking: true, error: null }));

        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                console.log('[Geolocation] Watch position update:', pos.coords.latitude, pos.coords.longitude, 'accuracy:', pos.coords.accuracy);
                handleSuccess(pos);
            },
            (err) => {
                console.error('[Geolocation] Watch error:', err.code, err.message);
                if (isMountedRef.current) {
                    const error = handleError(err);
                    setState(prev => ({
                        ...prev,
                        error,
                        isLoading: false,
                        // Stop tracking on permission denied
                        isTracking: error.type === 'PERMISSION_DENIED' ? false : prev.isTracking,
                    }));
                }
            },
            mergedOptions
        );
        console.log('[Geolocation] Watch ID:', watchIdRef.current);
    }, [state.isSupported, mergedOptions, handleSuccess, handleError]);

    // Stop tracking position
    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        setState(prev => ({
            ...prev,
            isTracking: false,
            isLoading: false,
        }));
    }, []);

    // Toggle tracking
    const toggleTracking = useCallback(() => {
        if (state.isTracking) {
            stopTracking();
        } else {
            startTracking();
        }
    }, [state.isTracking, startTracking, stopTracking]);

    // Clear position and errors
    const clearPosition = useCallback(() => {
        stopTracking();
        setState(prev => ({
            ...prev,
            position: null,
            error: null,
        }));
    }, [stopTracking]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    return {
        ...state,
        getCurrentPosition,
        startTracking,
        stopTracking,
        toggleTracking,
        clearPosition,
    };
}

export default useGeolocation;
