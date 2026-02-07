import React from 'react';

interface BottomStatusBarProps {
    mouseCoordinates: { lat: number; lng: number; height: number } | null;
    cameraHeight: number;
    projectionMode: string;
}

export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
    mouseCoordinates,
    cameraHeight,
    projectionMode
}) => {
    return (
        <div className="h-7 w-full flex items-center justify-between px-4 text-xs font-mono select-none z-10 relative bg-engineering-panel/80 backdrop-blur-md border-t border-engineering-border">
            {/* LEFT: Lat & Lon */}
            <div className="flex items-center gap-4 h-full">
                <div className="flex items-center gap-2">
                    <span className="text-engineering-text-secondary">LAT</span>
                    <span className="text-engineering-text-primary min-w-[80px]">
                        {mouseCoordinates ? mouseCoordinates.lat.toFixed(6) : '---.------'}
                    </span>
                </div>

                <div className="h-3 w-px bg-engineering-border" />

                <div className="flex items-center gap-2">
                    <span className="text-engineering-text-secondary">LON</span>
                    <span className="text-engineering-text-primary min-w-[80px]">
                        {mouseCoordinates ? mouseCoordinates.lng.toFixed(6) : '---.------'}
                    </span>
                </div>
            </div>

            {/* CENTER: Branding */}
            <div className="absolute left-1/2 top-0 h-full flex items-center -translate-x-1/2">
                <span className="text-[10px] text-engineering-text-muted">
                    Powered by <span className="text-engineering-primary font-semibold">Fixurelabs</span>
                </span>
            </div>

            {/* RIGHT: Elev, Alt, Projection (WGS84) */}
            <div className="flex items-center gap-4 h-full">
                <div className="flex items-center gap-2">
                    <span className="text-engineering-text-secondary">ELEV</span>
                    <span className="text-engineering-text-primary">
                        {mouseCoordinates ? `${mouseCoordinates.height.toFixed(1)}m` : '---'}
                    </span>
                </div>

                <div className="h-3 w-px bg-engineering-border" />

                <div className="flex items-center gap-2">
                    <span className="text-engineering-text-secondary">ALT</span>
                    <span className="text-engineering-text-primary">
                        {Math.round(cameraHeight).toLocaleString()}m
                    </span>
                </div>

                <div className="h-3 w-px bg-engineering-border" />

                <div className="flex items-center gap-2">
                    <span className="text-engineering-primary font-semibold">{projectionMode}</span>
                </div>
            </div>
        </div>
    );
};
