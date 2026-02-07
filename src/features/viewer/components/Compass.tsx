import React, { useRef, useEffect } from 'react';
import * as Cesium from 'cesium';

interface CompassProps {
    viewer: Cesium.Viewer | null;
    className?: string;
    style?: React.CSSProperties;
}

export const Compass: React.FC<CompassProps> = ({ viewer, className, style }) => {
    const compassRef = useRef<HTMLButtonElement>(null);
    const needleRef = useRef<SVGGElement>(null);

    // Optimized Rotation Logic (Direct DOM manipulation via postRender for 60fps)
    useEffect(() => {
        if (!viewer || viewer.isDestroyed()) {
            return;
        }

        const scene = viewer.scene;

        const updateCompass = () => {
            if (viewer.isDestroyed() || !needleRef.current) return;

            try {
                const heading = Cesium.Math.toDegrees(viewer.camera.heading);
                // Rotate the NEEDLE opposite to heading to point North
                // If heading is 90 (East), Needle should point Left (-90).
                needleRef.current.style.transform = `rotate(${-heading}deg)`;
            } catch (e) {
                // Ignore context lost errors
            }
        };

        scene.postRender.addEventListener(updateCompass);

        // Initial update
        updateCompass();

        return () => {
            if (!viewer.isDestroyed()) {
                scene.postRender.removeEventListener(updateCompass);
            }
        };
    }, [viewer]);

    const handleResetNorth = () => {
        if (!viewer || viewer.isDestroyed()) return;

        const currentPos = viewer.camera.positionCartographic;

        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromRadians(
                currentPos.longitude,
                currentPos.latitude,
                currentPos.height
            ),
            orientation: {
                heading: 0, // North
                pitch: viewer.camera.pitch,
                roll: 0
            },
            duration: 0.8,
            easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
        });
    };

    return (
        <button
            ref={compassRef}
            onClick={handleResetNorth}
            className={`
                group relative flex items-center justify-center
                w-20 h-20 rounded-full
                shadow-2xl
                transition-all duration-200
                hover:scale-105 active:scale-95
                ${className || ''}
            `}
            style={{
                zIndex: 100,
                background: 'linear-gradient(to bottom, #F7F7F7, #ECECEC)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0,0,0,0.05)',
                ...style
            }}
            title="Kuzeye Dön (Sıfırla)"
            aria-label="Kuzeye Dön"
        >
            {/* 
               SVG Reconstruction of compass-ref.txt 
               Original Size: 400px x 400px
               ViewBox: 0 0 400 400
            */}
            <svg
                viewBox="0 0 400 400"
                className="w-full h-full"
                style={{ filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.1))' }}
            >
                {/* Outer Body Gradient is handled by button background. 
                    Border Radius 100% handled by button.
                    We just need the Inner Body and Content.
                */}

                {/* Inner Body 
                    CSS: width 340px, height 340px, top 27.5, left 27.5. border 3px solid #C5C5C5. bg #3D3D3D.
                    Center: 200, 200. Radius: 170.
                */}
                <circle
                    cx="200" cy="200" r="170"
                    fill="#3D3D3D"
                    stroke="#C5C5C5" strokeWidth="6"
                />

                {/* Letters 
                    CSS: Font Lobster Two. Color #FFF.
                    Positions relative to 340x340 inner div (left 27.5, top 27.5)
                    North: left 155, top 10. (Center X of Inner = 170. 155 is -15px. width approx 30?).
                    Let's align them by center in SVG.
                    Center X = 200, Center Y = 200.
                    Radius of text placement approx 140?
                */}
                <style>
                    {`
                        .compass-text {
                            font-family: 'Lobster Two', serif; /* Fallback if not loaded */
                            font-size: 56px; /* Scaled from 36px relative to 340px container? 36px/340 ~ 0.1. 0.1*400 = 40. Lets try bigger. */
                            fill: #FFF;
                            font-weight: bold;
                            pointer-events: none;
                            user-select: none;
                        }
                    `}
                </style>

                {/* N - Top */}
                <text x="200" y="85" textAnchor="middle" className="compass-text">N</text>

                {/* E - Right */}
                <text x="325" y="220" textAnchor="middle" className="compass-text">E</text>

                {/* S - Bottom */}
                <text x="200" y="355" textAnchor="middle" className="compass-text">S</text>

                {/* W - Left */}
                <text x="75" y="220" textAnchor="middle" className="compass-text">W</text>

                {/* Rotating Needle Group 
                    CSS: main-arrow height 100% (of inner? 340px). width 30px.
                    Top part (Red): border-bottom 165px.
                    Bottom part (White): border-bottom 165px.
                    Center at 170,170 of inner -> 200,200 of outer.
                */}
                <g
                    ref={needleRef}
                    style={{
                        transformOrigin: '200px 200px',
                        transition: 'transform 0.1s linear'
                    }}
                >
                    {/* Shadow for depth */}
                    <path d="M200 60 L220 200 L200 340 L180 200 Z" fill="black" fillOpacity="0.3" transform="translate(4, 4)" />

                    {/* Arrow Up (Red) 
                        Tip at Top. Base at Center.
                        CSS arrow-up: border-bottom 165px #EF5052. width 0. borders 15px.
                        So Triangle: Bottom Width 30. Height 165.
                        Tip: (200, 200 - 165 - gap?).
                        Let's center it.
                        Total height 330.
                        Top Y: 200 - 165 = 35.
                        Bottom Y: 200 + 165 = 365.
                        Width 30. X from 185 to 215.
                    */}
                    <path d="M200 35 L215 200 L185 200 Z" fill="#EF5052" />

                    {/* Arrow Down (White) 
                        Tip at Bottom. Base at Center.
                    */}
                    <path d="M200 365 L215 200 L185 200 Z" fill="#F3F3F3" />

                    {/* Center Pin (Optional aesthetic addition) */}
                    <circle cx="200" cy="200" r="8" fill="#C5C5C5" />
                    <circle cx="200" cy="200" r="4" fill="#3D3D3D" />
                </g>
            </svg>
        </button>
    );
};
