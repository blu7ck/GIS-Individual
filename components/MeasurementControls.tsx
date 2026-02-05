import React from 'react';
import { Ruler, LayoutTemplate, MousePointer2 } from 'lucide-react';
import { MeasurementMode } from '../types';

interface Props {
  activeMode: MeasurementMode;
  onSetMode: (mode: MeasurementMode) => void;
}

export const MeasurementControls: React.FC<Props> = ({ activeMode, onSetMode }) => {
  return (
    <div className="bg-carta-deep-800/40 backdrop-blur-xl rounded-lg border border-carta-mist-700/30 shadow-xl p-3">
      <div className="text-xs font-semibold text-carta-mist-400 mb-2 uppercase tracking-wider">Measurement Tools</div>
      <div className="flex space-x-2">
        <button
          onClick={() => onSetMode(MeasurementMode.NONE)}
          className={`p-2 rounded transition-colors ${activeMode === MeasurementMode.NONE ? 'bg-carta-deep-600 text-white' : 'bg-carta-deep-700 text-carta-mist-400 hover:bg-carta-deep-600'}`}
          title="Pan/Select"
        >
          <MousePointer2 size={16} />
        </button>
        <button
          onClick={() => onSetMode(MeasurementMode.DISTANCE)}
          className={`p-2 rounded transition-colors ${activeMode === MeasurementMode.DISTANCE ? 'bg-carta-gold-500 text-white' : 'bg-carta-deep-700 text-carta-mist-400 hover:bg-carta-deep-600'}`}
          title="Distance"
        >
          <Ruler size={16} />
        </button>
        <button
          onClick={() => onSetMode(MeasurementMode.AREA)}
          className={`p-2 rounded transition-colors ${activeMode === MeasurementMode.AREA ? 'bg-carta-gold-500 text-white' : 'bg-carta-deep-700 text-carta-mist-400 hover:bg-carta-deep-600'}`}
          title="Area"
        >
          <LayoutTemplate size={16} />
        </button>
      </div>
    </div>
  );
};
