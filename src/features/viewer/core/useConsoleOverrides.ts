
import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

/**
 * Hook to suppress specific Cesium console warnings and errors
 * Handles KML StyleMap warnings and Billboard image loading errors
 */
export function useConsoleOverrides(viewer: Cesium.Viewer | null) {
    const originalConsoleWarnRef = useRef<typeof console.warn | null>(null);
    const originalConsoleErrorRef = useRef<typeof console.error | null>(null);

    useEffect(() => {
        // Store original console.warn and console.error
        if (!typeof window) return;

        if (!originalConsoleWarnRef.current) {
            originalConsoleWarnRef.current = console.warn;
        }
        if (!originalConsoleErrorRef.current) {
            originalConsoleErrorRef.current = console.error;
        }

        const originalWarn = originalConsoleWarnRef.current;

        // Override console.warn
        console.warn = (...args: any[]) => {
            const allArgsStr = args.map(arg => {
                if (typeof arg === 'string') return arg;
                if (arg && typeof arg === 'object') {
                    try { return String(arg); } catch { return ''; }
                }
                return String(arg);
            }).join(' ');

            const message = args[0];
            const checkStr = (typeof message === 'string' ? message : '') + ' ' + allArgsStr;

            if (typeof message === 'string' || allArgsStr) {
                if (checkStr.includes('StyleMap') || checkStr.includes('Unsupported StyleMap') || checkStr.includes('highlight')) {
                    return;
                }
                if (checkStr.includes('Error loading image for billboard') ||
                    (checkStr.includes('billboard') && (checkStr.includes('image') || checkStr.includes('Event')))) {
                    return;
                }
            }

            const hasEventObject = args.some(arg => {
                if (!arg || typeof arg !== 'object') return false;
                try {
                    const str = String(arg);
                    return str === '[object Event]' || str.includes('Event');
                } catch { return false; }
            });

            if (hasEventObject) {
                if (checkStr.includes('billboard') || checkStr.includes('image') || checkStr.includes('loading')) {
                    return;
                }
            }

            if (originalWarn) originalWarn.apply(console, args);
        };

        const originalError = originalConsoleErrorRef.current;

        // Override console.error
        console.error = (...args: any[]) => {
            const allArgsStr = args.map(arg => {
                if (typeof arg === 'string') return arg;
                if (arg && typeof arg === 'object') {
                    try { return String(arg); } catch { return ''; }
                }
                return String(arg);
            }).join(' ');

            const message = args[0];
            const checkStr = (typeof message === 'string' ? message : '') + ' ' + allArgsStr;

            if (typeof message === 'string' || allArgsStr) {
                if (checkStr.includes('Error loading image for billboard') ||
                    (checkStr.includes('billboard') && (checkStr.includes('image') || checkStr.includes('Event')))) {
                    return;
                }
            }

            const hasEventObject = args.some(arg => {
                if (!arg || typeof arg !== 'object') return false;
                try {
                    const str = String(arg);
                    return str === '[object Event]' || str.includes('Event');
                } catch { return false; }
            });

            if (hasEventObject) {
                if (checkStr.includes('billboard') || checkStr.includes('image') || checkStr.includes('loading')) {
                    return;
                }
            }

            if (originalError) originalError.apply(console, args);
        };

        return () => {
            if (originalConsoleWarnRef.current) {
                console.warn = originalConsoleWarnRef.current;
            }
            if (originalConsoleErrorRef.current) {
                console.error = originalConsoleErrorRef.current;
            }
        };
    }, [viewer]);
}
