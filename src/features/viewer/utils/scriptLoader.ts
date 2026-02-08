/**
 * Utility to load external scripts and CSS files dynamically.
 * Used for Potree and other heavy libraries that we don't want to bundle.
 */

const loadedScripts = new Set<string>();

export const loadScript = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (loadedScripts.has(url)) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = url;
        script.async = true;

        script.onload = () => {
            loadedScripts.add(url);
            resolve();
        };

        script.onerror = () => {
            reject(new Error(`Failed to load script: ${url}`));
        };

        document.body.appendChild(script);
    });
};

export const loadStylesheet = (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (loadedScripts.has(url)) {
            resolve();
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;

        link.onload = () => {
            loadedScripts.add(url);
            resolve();
        };

        link.onerror = () => {
            reject(new Error(`Failed to load stylesheet: ${url}`));
        };

        document.head.appendChild(link);
    });
};

/**
 * Loads the necessary Potree dependencies in the exact required order.
 * 1. jQuery
 * 2. Three.js
 * 3. Potree
 */
/**
 * Loads the necessary Potree dependencies in the exact required order.
 * 1. jQuery
 * 2. Three.js
 * 3. Potree
 */
export const loadPotreeDependencies = async () => {
    try {
        // 1. Load jQuery 
        if (!(window as any).$ && !(window as any).jQuery) {
            console.log('Loading jQuery (Local)...');
            await loadScript('/libs/jquery.min.js');
        }

        // 2. Load Proj4 (Required by Potree)
        if (!(window as any).proj4) {
            console.log('Loading Proj4 (Local)...');
            await loadScript('/libs/proj4.min.js');
        }

        // 3. Load Three.js 
        if (!(window as any).THREE) {
            console.log('Loading Three.js (Local)...');
            await loadScript('/libs/three.min.js');
        } else {
            console.log('Three.js already loaded, skipping...');
        }

        // 4. Load Tween.js (Required by Potree animations)
        if (!(window as any).TWEEN) {
            console.log('Loading Tween.js (Local)...');
            await loadScript('/libs/tween.min.js');
        }

        // 5. Load Potree & Dependencies
        if (!(window as any).Potree) {
            console.log('Loading Potree (Local)...');
            await loadStylesheet('/libs/potree.css');

            // BinaryHeap is often a separate utility in Potree builds
            await loadScript('/libs/BinaryHeap.js');

            await loadScript('/libs/potree.min.js');

            // CRITICAL: Tell Potree where to find its workers
            // Potree looks for 'workers/...' relative to this path
            if ((window as any).Potree) {
                (window as any).Potree.scriptPath = `${window.location.origin}/libs`;
                (window as any).Potree.resourcePath = `${window.location.origin}/libs/resources`;
            }
        }

    } catch (error) {
        console.error("Failed to load Potree dependencies", error);
        throw error;
    }
};
