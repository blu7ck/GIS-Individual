import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Layers, Map, X } from 'lucide-react';
import { MapType, QualitySettings } from '../types';
import { QualitySettingsPanel } from './QualitySettingsPanel';

interface Props {
  mapType: MapType;
  onMapTypeChange: (type: MapType) => void;
  qualitySettings?: QualitySettings;
  onQualityChange?: (settings: QualitySettings) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const MapControls: React.FC<Props> = ({
  mapType,
  onMapTypeChange,
  qualitySettings,
  onQualityChange,
  isOpen,
  onToggle
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const MAP_TYPES: Record<string, string> = {
    'BING_MAPS': 'Default',
    'OPENSTREETMAP': 'OpenStreetMap',
    'SATELLITE': 'Satellite',
    'TERRAIN_3D': 'Terrain 3D',
    'HYBRID': 'Hybrid'
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Mobile Overlay
  if (isMobile && isOpen) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-[#1C1B19]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-[#1C1B19]/90 backdrop-blur-xl border border-[#57544F]/50 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 max-h-[85vh] overflow-y-auto" ref={ref}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#57544F]/50 sticky top-0 bg-[#1C1B19]/95 backdrop-blur-xl z-10">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Layers size={18} className="text-[#12B285]" />
              Harita Ayarları
            </h3>
            <button
              onClick={onToggle}
              className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 space-y-6">
            {/* Map Types */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Harita Stili</label>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(MAP_TYPES).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => {
                      onMapTypeChange(type as MapType);
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${mapType === type
                      ? 'bg-[#12B285]/20 border-[#12B285]/50 text-white'
                      : 'bg-black/20 border-[#57544F]/30 text-gray-300 hover:bg-white/5'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <Map size={16} className={mapType === type ? 'text-[#12B285]' : 'text-gray-500'} />
                      {label}
                    </span>
                    {mapType === type && <div className="w-2 h-2 rounded-full bg-[#12B285]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Settings */}
            {qualitySettings && onQualityChange && (
              <div className="border-t border-[#57544F]/50 pt-4">
                <QualitySettingsPanel
                  qualitySettings={qualitySettings}
                  onQualityChange={onQualityChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Desktop Dropdown
  return (
    <div className="relative pointer-events-auto" ref={ref}>
      <button
        onClick={onToggle}
        className={`w-10 h-10 md:w-12 md:h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 border
          ${isOpen
            ? 'bg-[#12B285] text-white border-[#12B285]'
            : 'bg-[#1C1B19]/90 text-[#57544F] border-[#57544F] hover:text-white hover:border-[#12B285] hover:bg-[#1C1B19]'
          }
        `}
        title="Harita Ayarları"
      >
        <Layers size={20} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-[#1C1B19]/90 backdrop-blur-xl border border-[#57544F] rounded-xl shadow-2xl p-3 min-w-[280px] max-w-[320px] animate-in slide-in-from-top-2 origin-top-right max-h-[80vh] overflow-y-auto">
          {/* Map Style Section */}
          <div className="space-y-1 mb-4">
            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Harita Stili</div>
            {Object.entries(MAP_TYPES).map(([type, label]) => (
              <button
                key={type}
                onClick={() => {
                  onMapTypeChange(type as MapType);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between
                  ${mapType === type
                    ? 'bg-[#12B285]/20 text-[#12B285]'
                    : 'text-gray-300 hover:bg-[#57544F]/30 hover:text-white'
                  }
                `}
              >
                {label}
                {mapType === type && <div className="w-1.5 h-1.5 rounded-full bg-[#12B285]" />}
              </button>
            ))}
          </div>

          {/* Quality Settings Section */}
          {qualitySettings && onQualityChange && (
            <div className="border-t border-[#57544F]/50 pt-3">
              <QualitySettingsPanel
                qualitySettings={qualitySettings}
                onQualityChange={onQualityChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
