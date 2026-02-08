import React, { useState, useEffect } from 'react';
// import { Button } from '../../../components/ui/button'; // Not using Shadcn Button, using custom HTML buttons
import {
    Ruler,
    Settings,
    MousePointer2,
    BoxSelect,
    Trash2,
    Activity,
    Maximize,
    Globe,
    Plane
} from 'lucide-react';
import { cn } from '../../../lib/utils';
// import { Slider } from '../../../components/ui/slider'; // Using native range input

interface PotreeToolbarProps {
    viewer: any;
}

export const PotreeToolbar: React.FC<PotreeToolbarProps> = ({ viewer }) => {
    const [activePanel, setActivePanel] = useState<'none' | 'measurements' | 'tools'>('none');
    const [edlEnabled, setEdlEnabled] = useState(true);
    const [edlRadius, setEdlRadius] = useState(1.4);
    const [pointBudget, setPointBudget] = useState(2_000_000);

    // Initial sync
    useEffect(() => {
        if (!viewer) return;
        // Basic sync might be needed if values change externally, but for now we assume we control them.
    }, [viewer]);

    const handlePanelToggle = (panel: 'measurements' | 'tools') => {
        if (activePanel === panel) {
            setActivePanel('none');
        } else {
            setActivePanel(panel);
        }
    };

    // --- Measurement Actions ---
    const startMeasurement = (type: 'Distance' | 'Area' | 'Height' | 'Circle' | 'Volume' | 'Profile') => {
        if (!viewer) return;
        const tool = viewer.measuringTool;

        // Start specific measurement
        switch (type) {
            case 'Distance':
                tool.startInsertion({ showDistances: true, showAngles: false, showCoordinates: false, showArea: false, closed: false, name: 'Distance' });
                break;
            case 'Area':
                tool.startInsertion({ showDistances: true, showAngles: false, showCoordinates: false, showArea: true, closed: true, name: 'Area' });
                break;
            case 'Height':
                tool.startInsertion({ showDistances: false, showHeight: true, closed: false, name: 'Height' });
                break;
            case 'Volume':
                // Volume often requires a specific tool or profile. Potree 1.8 has VolumeTool.
                if (viewer.volumeTool) {
                    viewer.volumeTool.startInsertion();
                }
                break;
            case 'Profile':
                if (viewer.profileTool) {
                    viewer.profileTool.startInsertion();
                }
                break;
        }
    };

    const clearMeasurements = () => {
        if (!viewer) return;
        viewer.scene.removeAllMeasurements();
        if (viewer.scene.removeAllVolumes) viewer.scene.removeAllVolumes();
        if (viewer.scene.removeAllProfiles) viewer.scene.removeAllProfiles();
    };

    // --- Tool Actions ---
    const setNavigationMode = (mode: 'Orbit' | 'Flight' | 'Earth') => {
        if (!viewer) return;
        switch (mode) {
            case 'Orbit':
                if (viewer.orbitControls) viewer.setControls(viewer.orbitControls);
                break;
            case 'Flight':
                if (viewer.fpControls) viewer.setControls(viewer.fpControls);
                else if (viewer.firstPersonControls) viewer.setControls(viewer.firstPersonControls);
                break;
            case 'Earth':
                if (viewer.earthControls) viewer.setControls(viewer.earthControls);
                break;
        }
    };

    const toggleEDL = (enabled: boolean) => {
        if (!viewer) return;
        viewer.setEDLEnabled(enabled);
        setEdlEnabled(enabled);
    };

    const updateEDLRadius = (val: number) => {
        if (!viewer) return;
        viewer.setEDLRadius(val);
        setEdlRadius(val);
    };

    const updatePointBudget = (val: number) => {
        if (!viewer) return;
        viewer.setPointBudget(val);
        setPointBudget(val);
    };

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-[1000] pointer-events-none">

            {/* --- PANELS (Opens Upwards) --- */}
            {activePanel === 'measurements' && (
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl w-max pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-200 mb-4">
                    <h3 className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-3">Measurement Tools</h3>
                    <div className="grid grid-cols-4 gap-2">
                        <ToolButton icon={<Ruler />} label="Distance" onClick={() => startMeasurement('Distance')} />
                        <ToolButton icon={<BoxSelect />} label="Area" onClick={() => startMeasurement('Area')} />
                        <ToolButton icon={<Maximize className="rotate-90" />} label="Height" onClick={() => startMeasurement('Height')} />
                        <ToolButton icon={<Activity />} label="Profile" onClick={() => startMeasurement('Profile')} />
                        <ToolButton icon={<BoxSelect />} label="Volume" onClick={() => startMeasurement('Volume')} />
                        <div className="col-span-1" /> {/* Spacer */}
                        <div className="col-span-1" /> {/* Spacer */}
                        <ToolButton icon={<Trash2 />} label="Clear All" onClick={clearMeasurements} variant="danger" />
                    </div>
                </div>
            )}

            {activePanel === 'tools' && (
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl w-[300px] pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-200 flex flex-col gap-4 mb-4">

                    {/* EDL Settings */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="text-white/80 text-xs font-semibold uppercase tracking-wider">Eye Dome Lighting</h3>
                            <input
                                type="checkbox"
                                checked={edlEnabled}
                                onChange={(e) => toggleEDL(e.target.checked)}
                                className="toggle-checkbox"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-white/50">Radius</span>
                            <input
                                type="range"
                                min="0.5" max="4.0" step="0.1"
                                value={edlRadius}
                                onChange={(e) => updateEDLRadius(parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="text-xs text-white/70 w-8 text-right">{edlRadius}</span>
                        </div>
                    </div>

                    {/* Point Budget */}
                    <div>
                        <h3 className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-1">Point Budget</h3>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="100000" max="10000000" step="100000"
                                value={pointBudget}
                                onChange={(e) => updatePointBudget(parseInt(e.target.value))}
                                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="text-xs text-white/50 text-right mt-1">
                            {(pointBudget / 1_000_000).toFixed(1)}M points
                        </div>
                    </div>
                </div>
            )}


            {/* --- MAIN TOOLBAR --- */}
            <div className="flex items-center gap-2 pointer-events-auto bg-black/40 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl">

                {/* Navigation Group (Open/Visible) */}
                <div className="flex items-center gap-1 pr-4 border-r border-white/10 mr-2">
                    <NavButton icon={<MousePointer2 />} label="Orbit" onClick={() => setNavigationMode('Orbit')} />
                    <NavButton icon={<Plane />} label="Fly" onClick={() => setNavigationMode('Flight')} />
                    <NavButton icon={<Globe />} label="Earth" onClick={() => setNavigationMode('Earth')} />
                </div>

                {/* Tools Group */}
                <MainButton
                    icon={<Ruler className="w-5 h-5" />}
                    label="Measurements"
                    isActive={activePanel === 'measurements'}
                    onClick={() => handlePanelToggle('measurements')}
                />
                <MainButton
                    icon={<Settings className="w-5 h-5" />}
                    label="Tools"
                    isActive={activePanel === 'tools'}
                    onClick={() => handlePanelToggle('tools')}
                />
            </div>
        </div>
    );
};

// --- Helper Components ---

const MainButton = ({ icon, label, isActive, onClick }: any) => (
    <button
        onClick={onClick}
        className={cn(
            "flex items-center justify-center w-14 h-14 rounded-full border border-white/10 transition-all duration-300 shadow-lg backdrop-blur-md group relative",
            isActive
                ? "bg-primary text-white scale-110 shadow-[0_0_20px_rgba(59,130,246,0.6)] border-primary"
                : "bg-black/40 text-white/80 hover:bg-white/10 hover:border-white/30 hover:scale-105"
        )}
    >
        {icon}
        {/* Tooltip Label */}
        <span className="absolute -bottom-8 text-xs font-medium text-white/80 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 px-2 py-1 rounded pointer-events-none">
            {label}
        </span>
    </button>
);

const ToolButton = ({ icon, label, onClick, variant = 'default' }: any) => (
    <button
        onClick={onClick}
        className={cn(
            "flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 w-full aspect-square border border-transparent",
            variant === 'danger'
                ? "text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
                : "text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20"
        )}
    >
        <div className="mb-1">{React.cloneElement(icon, { className: "w-5 h-5" })}</div>
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
    </button>
);

const NavButton = ({ icon, label, onClick }: any) => (
    <button
        onClick={onClick}
        className="flex-1 flex items-center justify-center gap-2 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors"
    >
        {React.cloneElement(icon, { className: "w-4 h-4" })}
        <span className="text-xs font-medium">{label}</span>
    </button>
);
