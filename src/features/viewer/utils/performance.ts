/**
 * Performance utilities for Cesium Viewer
 */

/**
 * Throttle a function to execute at most once every `limit` milliseconds
 */
export function throttle<T extends (...args: unknown[]) => void>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return function (this: unknown, ...args: Parameters<T>) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

/**
 * Debounce a function to execute after `delay` milliseconds of inactivity
 */
export function debounce<T extends (...args: unknown[]) => void>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout>;

    return function (this: unknown, ...args: Parameters<T>) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Check if the current device is mobile based on user agent and touch capabilities
 */
export function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;

    const userAgent = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera;

    // Check for mobile user agents
    if (/windows phone/i.test(userAgent || '')) return true;
    if (/android/i.test(userAgent || '')) return true;
    if (/iPad|iPhone|iPod/.test(userAgent || '') && !(window as unknown as { MSStream?: unknown }).MSStream) return true;

    // Check for touch capability as a fallback/confirmation
    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0
    );
}

/**
 * Check specifically for Android devices
 */
export function isAndroidDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return /android/i.test(navigator.userAgent || '');
}

/**
 * Check if WebGL is supported
 */
export function isWebGLSupported(): boolean {
    try {
        const canvas = document.createElement('canvas');
        return !!(
            window.WebGLRenderingContext &&
            (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
        );
    } catch (e) {
        return false;
    }
}
