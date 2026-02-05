import React from 'react';

interface BottomStatusBarProps {
    mouseCoordinates: { lat: number; lng: number; height: number } | null;
    cameraHeight: number;
    zoomLevel: number;
    projectionMode: string;
}

export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
    mouseCoordinates,
    cameraHeight,
    zoomLevel: _zoomLevel,
    projectionMode
}) => {
    return (
        <div className="h-6 bg-engineering-panel border-t border-engineering-border flex items-center justify-between px-2 text-xs font-mono text-engineering-text-secondary select-none z-10 w-full">
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1 min-w-[200px]">
                    <span className="text-engineering-text-muted">LAT:</span>
                    <span className="min-w-[70px]">{mouseCoordinates ? mouseCoordinates.lat.toFixed(6) : '---.------'}</span>
                    <span className="text-engineering-text-muted ml-2">LON:</span>
                    <span className="min-w-[70px]">{mouseCoordinates ? mouseCoordinates.lng.toFixed(6) : '---.------'}</span>
                </div>

                <div className="flex items-center space-x-1 border-l border-engineering-border pl-2">
                    <span className="text-engineering-text-muted">ELEV:</span>
                    <span>{mouseCoordinates ? `${mouseCoordinates.height.toFixed(1)}m` : '---'}</span>
                </div>
            </div>

            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                    <span className="text-engineering-text-muted">ALT:</span>
                    <span>{Math.round(cameraHeight).toLocaleString()}m</span>
                </div>

                <div className="border-l border-engineering-border pl-2">
                    <span className="text-engineering-primary">{projectionMode}</span>
                </div>
            </div>
        </div>
    );
};
