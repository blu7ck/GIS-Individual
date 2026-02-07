import React from 'react';
import { Ruler, Trash2 } from 'lucide-react';
import { AssetLayer, MeasurementMode } from '../../../types';

interface Props {
    measurementMode: MeasurementMode;
    setMeasurementMode: (mode: MeasurementMode) => void;
    measurements: AssetLayer[];
    onClearMeasurements: () => void;
    toolbarOpen: boolean;
    setToolbarOpen: (open: boolean) => void;
}

export const SecureMeasurementToolbar: React.FC<Props> = ({
    measurementMode,
    setMeasurementMode,
    measurements,
    onClearMeasurements,
    toolbarOpen,
    // setToolbarOpen - unused
}) => {
    if (!toolbarOpen) return null;

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-1.5 rounded-xl shadow-xl flex items-center space-x-1">
            <button
                onClick={() => setMeasurementMode(measurementMode === MeasurementMode.DISTANCE ? MeasurementMode.NONE : MeasurementMode.DISTANCE)}
                className={`p-2 rounded-lg transition-all ${measurementMode === MeasurementMode.DISTANCE ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Measure Distance"
            >
                <Ruler size={20} />
            </button>

            <div className="w-px h-6 bg-slate-700 mx-1" />

            {measurements.length > 0 && (
                <div className="flex items-center space-x-2 px-2">
                    <span className="text-xs font-mono font-medium text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded border border-emerald-900/50">
                        {measurements[measurements.length - 1]?.data?.value}
                    </span>
                    <button
                        onClick={onClearMeasurements}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                        title="Clear Measurements"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )}

            {measurements.length === 0 && measurementMode === MeasurementMode.NONE && (
                <span className="text-xs text-slate-500 px-2">Select tool</span>
            )}
        </div>
    );
};
