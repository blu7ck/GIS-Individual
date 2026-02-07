import React from 'react';
import { Globe } from 'lucide-react';


import { SceneViewMode } from '../../types';

interface Props {
  currentMode: SceneViewMode;
  onModeChange: (mode: SceneViewMode) => void;
}

export const SceneModeSelector: React.FC<Props> = ({ currentMode, onModeChange }) => {
  const modes = [
    { mode: SceneViewMode.SCENE3D, label: '3D Globe', icon: Globe, color: 'text-blue-400' },
  ];

  return (
    <div className="absolute top-4 right-56 z-30 bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl p-2">
      <div className="flex flex-col space-y-1">
        {modes.map(({ mode, label, icon: Icon, color }) => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={`
              flex items-center space-x-2 px-3 py-2 rounded transition-all
              ${currentMode === mode
                ? 'bg-emerald-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }
            `}
            title={label}
          >
            <Icon size={16} className={currentMode === mode ? 'text-white' : color} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

