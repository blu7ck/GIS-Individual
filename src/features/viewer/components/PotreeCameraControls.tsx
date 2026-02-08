import React, { useState, useEffect } from 'react';
// import { Button } from '../../../components/ui/button'; // Not using Shadcn Button, using custom HTML buttons
import {
    Box,
    Monitor,
    Globe,
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight
} from 'lucide-react';
import { cn } from '../../../lib/utils'; // Assuming tailwind-merge util

interface PotreeCameraControlsProps {
    viewer: any; // Potree.Viewer instance
}

export const PotreeCameraControls: React.FC<PotreeCameraControlsProps> = ({ viewer }) => {
    const [projection, setProjection] = useState<'Perspective' | 'Orthographic'>('Perspective');

    useEffect(() => {
        if (!viewer) return;

        // Listen for projection changes if possible, or just sync on mount
        // Potree doesn't emit easy events for this, so we rely on our buttons updating state.
    }, [viewer]);

    const handleProjectionChange = (mode: 'Perspective' | 'Orthographic') => {
        if (!viewer) return;

        const cameraMode = mode === 'Perspective'
            ? window.Potree.CameraMode.PERSPECTIVE
            : window.Potree.CameraMode.ORTHOGRAPHIC;

        viewer.setCameraMode(cameraMode);
        setProjection(mode);
    };

    const handleViewChange = (view: 'Top' | 'Bottom' | 'Front' | 'Back' | 'Left' | 'Right') => {
        if (!viewer) return;

        switch (view) {
            case 'Top': viewer.setTopView(); break;
            case 'Bottom': viewer.setBottomView(); break;
            case 'Front': viewer.setFrontView(); break;
            case 'Back': viewer.setBackView(); break;
            case 'Left': viewer.setLeftView(); break;
            case 'Right': viewer.setRightView(); break;
        }
    };

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[1000] pointer-events-none">
            {/* Projection Toggle */}
            <div className="flex bg-black/40 backdrop-blur-md rounded-lg p-1 gap-1 pointer-events-auto border border-white/10 shadow-lg">
                <button
                    onClick={() => handleProjectionChange('Perspective')}
                    className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-2",
                        projection === 'Perspective'
                            ? "bg-primary/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                            : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                >
                    <Globe className="w-3.5 h-3.5" />
                    Perspective
                </button>
                <div className="w-[1px] bg-white/10 my-1" />
                <button
                    onClick={() => handleProjectionChange('Orthographic')}
                    className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-2",
                        projection === 'Orthographic'
                            ? "bg-primary/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                            : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                >
                    <Monitor className="w-3.5 h-3.5" />
                    Orthographic
                </button>
            </div>

            {/* Cube Views */}
            <div className="flex bg-black/40 backdrop-blur-md rounded-lg p-1 gap-1 pointer-events-auto border border-white/10 shadow-lg">
                <ViewButton icon={<ArrowUp className="w-4 h-4" />} label="Top" onClick={() => handleViewChange('Top')} />
                <ViewButton icon={<ArrowDown className="w-4 h-4" />} label="Bottom" onClick={() => handleViewChange('Bottom')} />
                <ViewButton icon={<Box className="w-4 h-4" />} label="Front" onClick={() => handleViewChange('Front')} />
                <ViewButton icon={<Box className="w-4 h-4 rotate-180" />} label="Back" onClick={() => handleViewChange('Back')} />
                <ViewButton icon={<ArrowLeft className="w-4 h-4" />} label="Left" onClick={() => handleViewChange('Left')} />
                <ViewButton icon={<ArrowRight className="w-4 h-4" />} label="Right" onClick={() => handleViewChange('Right')} />
            </div>
        </div>
    );
};

// Helper sub-component for View Buttons
const ViewButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
    <button
        onClick={onClick}
        title={label}
        className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
    >
        {icon}
    </button>
);
