import React from 'react';
import { Ruler, Trash2, Square } from 'lucide-react';
import { MeasurementMode } from '../types';
import { ToolbarItem } from './ToolbarItem';

interface Props {
    activeMode: MeasurementMode;
    onSetMode: (mode: MeasurementMode) => void;
    isOpen: boolean;
    onToggle: () => void;
}

export const MeasurementTool: React.FC<Props> = ({ activeMode, onSetMode, isOpen, onToggle }) => {

    return (
        <ToolbarItem
            icon={<Ruler size={20} />}
            label="Measurement Tools"
            isOpen={isOpen}
            onToggle={onToggle}
            isActive={activeMode !== MeasurementMode.NONE}
        >
            <div className="flex items-center gap-2">
                <button
                    onClick={() => {
                        onSetMode(MeasurementMode.DISTANCE);
                        // Don't close to allow multiple measurements or mode switching
                    }}
                    className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${activeMode === MeasurementMode.DISTANCE
                        ? 'bg-[#12B285]/20 border-[#12B285] text-[#12B285]'
                        : 'bg-[#1C1B19] border-[#57544F] text-gray-400 hover:bg-[#57544F]/30 hover:text-white'
                        }`}
                    title="Distance Measurement"
                >
                    <Ruler size={24} className="mb-1" />
                    <span className="text-[10px] font-medium">Distance</span>
                </button>

                <button
                    onClick={() => {
                        onSetMode(MeasurementMode.AREA);
                        // Don't close
                    }}
                    className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${activeMode === MeasurementMode.AREA
                        ? 'bg-[#12B285]/20 border-[#12B285] text-[#12B285]'
                        : 'bg-[#1C1B19] border-[#57544F] text-gray-400 hover:bg-[#57544F]/30 hover:text-white'
                        }`}
                    title="Area Measurement"
                >
                    <Square size={24} className="mb-1" />
                    <span className="text-[10px] font-medium">Area</span>
                </button>
            </div>

            {activeMode !== MeasurementMode.NONE && (
                <>
                    <div className="h-px bg-[#57544F]/30 my-3" />
                    <button
                        onClick={() => onSetMode(MeasurementMode.NONE)}
                        className="w-full py-2 px-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-2 text-xs font-medium transition-colors"
                    >
                        <Trash2 size={14} />
                        Clear Measurement
                    </button>
                </>
            )}
        </ToolbarItem>
    );
};
