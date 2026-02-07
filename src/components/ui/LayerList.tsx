import React from 'react';
import { Eye, EyeOff, Trash2, Box, Map, Globe } from 'lucide-react';
import { Layer, LayerType } from '../../types';

interface LayerListProps {
  layers: Layer[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenModelViewer: (layer: Layer) => void;
}

export const LayerList: React.FC<LayerListProps> = ({ layers, onToggle, onDelete, onOpenModelViewer }) => {
  const getIcon = (type: LayerType) => {
    switch (type) {
      case LayerType.KML: return <Map size={14} className="text-yellow-400" />;
      case LayerType.DXF: return <Map size={14} className="text-blue-400" />;
      case LayerType.SHP: return <Map size={14} className="text-cyan-400" />;
      case LayerType.TILES_3D: return <Globe size={14} className="text-blue-400" />;
      case LayerType.GLB_UNCOORD: return <Box size={14} className="text-purple-400" />;
      default: return <Map size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl overflow-hidden flex flex-col max-h-[400px]">
      <div className="p-3 bg-gray-900 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300">Active Layers</h3>
      </div>
      <div className="overflow-y-auto p-2 space-y-2">
        {layers.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">No layers added.</p>
        )}
        {layers.map(layer => (
          <div key={layer.id} className="flex items-center justify-between bg-gray-700/50 p-2 rounded hover:bg-gray-700 transition-colors">
            <div className="flex items-center space-x-2 overflow-hidden">
              {getIcon(layer.type)}
              <span className="text-xs text-gray-200 truncate max-w-[120px]" title={layer.name}>
                {layer.name}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              {layer.type === LayerType.GLB_UNCOORD && (
                <button
                  onClick={() => onOpenModelViewer(layer)}
                  className="p-1 text-gray-400 hover:text-white"
                  title="Open Viewer"
                >
                  <Box size={14} />
                </button>
              )}

              {/* Only show toggle for map layers */}
              {layer.type !== LayerType.GLB_UNCOORD && (
                <button onClick={() => onToggle(layer.id)} className="p-1 text-gray-400 hover:text-emerald-400">
                  {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              )}

              <button onClick={() => onDelete(layer.id)} className="p-1 text-gray-400 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};