import React from 'react';
import { Map, Box } from 'lucide-react';
import { MapType } from '../types';

interface Props {
  currentMapType: MapType;
  onMapTypeChange: (type: MapType) => void;
}

export const MapTypeSelector: React.FC<Props> = ({ currentMapType, onMapTypeChange }) => {
  const mapTypes = [
    { type: MapType.OPENSTREETMAP, label: '2D Map', icon: Map, color: 'text-blue-400' },
    { type: MapType.TERRAIN_3D, label: '3D Terrain', icon: Box, color: 'text-cyan-400' },
  ];

  return (
    <div className="absolute top-4 right-4 z-30 bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl p-2">
      <div className="flex flex-col space-y-1">
        {mapTypes.map(({ type, label, icon: Icon, color }) => (
          <button
            key={type}
            onClick={() => onMapTypeChange(type)}
            className={`
              flex items-center space-x-2 px-3 py-2 rounded transition-all
              ${currentMapType === type
                ? 'bg-emerald-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }
            `}
            title={label}
          >
            <Icon size={16} className={currentMapType === type ? 'text-white' : color} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

