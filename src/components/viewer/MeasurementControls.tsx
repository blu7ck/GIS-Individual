import React from 'react';
import { Ruler, LayoutTemplate, MousePointer2 } from 'lucide-react';
import { MeasurementMode } from '../../types';

interface Props {
  activeMode: MeasurementMode;
  onSetMode: (mode: MeasurementMode) => void;
}

export const MeasurementControls: React.FC<Props> = ({ activeMode, onSetMode }) => {
  return (
    <div className="bg-black/90 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-4 transition-all duration-300">
      <div className="text-[10px] font-bold text-gray-400 mb-3 uppercase tracking-widest flex items-center gap-2">
        <MousePointer2 size={12} className="text-carta-gold-500" />
        Ölçüm Araçları
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => onSetMode(MeasurementMode.NONE)}
          className={`p-2.5 rounded-xl transition-all ${activeMode === MeasurementMode.NONE ? 'bg-white text-black shadow-lg' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
          title="Pan/Select"
        >
          <MousePointer2 size={16} />
        </button>
        <button
          onClick={() => onSetMode(MeasurementMode.DISTANCE)}
          className={`p-2.5 rounded-xl transition-all ${activeMode === MeasurementMode.DISTANCE ? 'bg-carta-gold-500 text-white shadow-lg' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
          title="Distance"
        >
          <Ruler size={16} />
        </button>
        <button
          onClick={() => onSetMode(MeasurementMode.AREA)}
          className={`p-2.5 rounded-xl transition-all ${activeMode === MeasurementMode.AREA ? 'bg-carta-gold-500 text-white shadow-lg' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
          title="Area"
        >
          <LayoutTemplate size={16} />
        </button>
      </div>
    </div>
  );
};
