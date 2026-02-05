
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Viewer } from 'cesium';
import * as Cesium from 'cesium';

interface CompassProps {
    viewer: Viewer | null;
}

export const Compass: React.FC<CompassProps> = ({ viewer }) => {
    const [compassHeading, setCompassHeading] = useState<number>(0);
    const compassSvgRef = useRef<SVGSVGElement | null>(null);

    // Update compass heading based on camera orientation
    useEffect(() => {
        if (!viewer) return;

        let timeoutId: number | null = null;
        let isMounted = true;
        let lastHeading = -999;
        let updateCompass: (() => void) | null = null;

        const setupCompass = () => {
            if (!isMounted) return;

            if (viewer.isDestroyed()) return;

            const scene = viewer.scene;
            const camera = viewer.camera;
            if (!scene || !camera) {
                timeoutId = window.setTimeout(setupCompass, 100);
                return;
            }

            updateCompass = () => {
                try {
                    if (!isMounted || viewer.isDestroyed() || scene.isDestroyed()) return;

                    const heading = Cesium.Math.toDegrees(camera.heading);

                    if (Math.abs(heading - lastHeading) > 0.01) {
                        lastHeading = heading;
                        if (compassSvgRef.current) {
                            compassSvgRef.current.style.transform = `rotate(${-heading}deg)`;
                        }
                        // Sync state for accessibility/other uses if needed
                        setCompassHeading(heading);
                    }
                } catch (e) { }
            };

            if (updateCompass) updateCompass();
            scene.postRender.addEventListener(updateCompass);
        };

        setupCompass();

        return () => {
            isMounted = false;
            if (timeoutId !== null) clearTimeout(timeoutId);
            try {
                if (viewer && !viewer.isDestroyed()) {
                    const scene = viewer.scene;
                    if (!scene.isDestroyed() && updateCompass) {
                        scene.postRender.removeEventListener(updateCompass);
                    }
                }
            } catch (e) { }
        };
    }, [viewer]);

    const resetToNorth = useCallback(() => {
        if (!viewer || viewer.isDestroyed()) return;
        const camera = viewer.camera;
        const currentPosition = camera.positionCartographic;

        camera.flyTo({
            destination: Cesium.Cartesian3.fromRadians(
                currentPosition.longitude,
                currentPosition.latitude,
                currentPosition.height
            ),
            orientation: {
                heading: 0,
                pitch: camera.pitch,
                roll: 0
            },
            duration: 0.5
        });
    }, [viewer]);

    return (
        <button
            onClick={resetToNorth}
            className="absolute top-4 left-4 z-10 w-14 h-14 bg-gray-900/90 backdrop-blur-md border border-gray-600 rounded-full flex items-center justify-center hover:bg-gray-800 hover:border-gray-500 transition-all shadow-xl cursor-pointer group"
            title="Click to reset to North"
            style={{
                boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
            }}
        >
            <svg
                ref={compassSvgRef}
                width="44"
                height="44"
                viewBox="0 0 44 44"
                className="transition-transform duration-150 ease-out"
                style={{ transform: `rotate(${-compassHeading}deg)` }}
            >
                <circle cx="22" cy="22" r="20" fill="none" stroke="#4B5563" strokeWidth="1" />
                <defs>
                    <radialGradient id="compassBg" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#374151" />
                        <stop offset="100%" stopColor="#1F2937" />
                    </radialGradient>
                </defs>
                <circle cx="22" cy="22" r="18" fill="url(#compassBg)" />
                <text x="22" y="9" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#EF4444" className="select-none">N</text>
                <text x="22" y="39" textAnchor="middle" fontSize="6" fill="#9CA3AF" className="select-none">S</text>
                <text x="6" y="24" textAnchor="middle" fontSize="6" fill="#9CA3AF" className="select-none">W</text>
                <text x="38" y="24" textAnchor="middle" fontSize="6" fill="#9CA3AF" className="select-none">E</text>
                <polygon points="22,6 19,22 22,20 25,22" fill="#EF4444" stroke="#DC2626" strokeWidth="0.5" />
                <polygon points="22,38 19,22 22,24 25,22" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="0.5" />
                <circle cx="22" cy="22" r="3" fill="#374151" stroke="#6B7280" strokeWidth="1" />
                <circle cx="22" cy="22" r="1.5" fill="#9CA3AF" />
            </svg>
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)' }}
            />
        </button>
    );
};
