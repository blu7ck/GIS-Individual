import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Layers, Map } from 'lucide-react';
import { MapType, QualitySettings } from '../../types';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const panelContent = (
    <div className="p-6 pt-8 space-y-6">

      <div className="space-y-4">
        {/* Map Type Selection */}
        <section className="space-y-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            GÖRÜNÜM SETİ
          </label>
          <div className="flex gap-2">
            {[
              { type: MapType.STANDARD, label: 'Kartografik', icon: <Map className="w-4 h-4" />, color: '#FBBF24', textColor: 'black' },
              { type: MapType.SATELLITE, label: 'Uydu', icon: <Layers className="w-4 h-4" />, color: '#78350F', textColor: 'white' }
            ].map(({ type, label, icon, color, textColor }) => (
              <button
                key={type}
                onClick={() => onMapTypeChange(type)}
                style={mapType === type ? { backgroundColor: color, borderColor: color, color: textColor, boxShadow: `0 4px 20px ${color}66` } : {}}
                className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 px-3 rounded-2xl border-2 transition-all duration-300 ${mapType === type
                  ? 'font-bold'
                  : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/10 hover:text-white'
                  }`}
              >
                {icon}
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Integrated Quality Settings */}
        {qualitySettings && onQualityChange && (
          <section className="space-y-4 pt-4 border-t border-white/5">
            <QualitySettingsPanel
              qualitySettings={qualitySettings}
              onQualityChange={onQualityChange}
            />
          </section>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative inline-block pointer-events-auto">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={onToggle}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl border-2
          ${isOpen
            ? 'bg-white/20 border-white/30 text-white rotate-90 scale-105 shadow-white/10'
            : 'bg-black/60 backdrop-blur-xl border-white/10 text-white hover:border-white/30 hover:shadow-white/5 hover:scale-110'
          }
        `}
      >
        <Layers className="w-6 h-6" />
      </button>

      {/* PORTAL for guaranteed positioning */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden">
          {/* Backdrop for mobile */}
          {isMobile && (
            <div
              className="absolute inset-x-0 bottom-0 top-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity"
              onClick={onToggle}
            />
          )}

          <div
            ref={panelRef}
            style={isMobile ? {} : {
              position: 'fixed',
              bottom: '120px',
              right: '16px'
            }}
            className={`pointer-events-auto shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-white/10 bg-white/5 backdrop-blur-3xl transition-all duration-500
              ${isMobile
                ? 'fixed bottom-0 left-0 right-0 rounded-t-3xl border-t border-white/10 animate-in slide-in-from-bottom-full'
                : 'w-[400px] rounded-[32px] animate-in slide-in-from-bottom-4 fade-in overflow-hidden'
              }
            `}
          >
            <div className={`${isMobile ? 'max-h-[80vh]' : 'max-h-[70vh]'} overflow-y-auto custom-scrollbar`}>
              {panelContent}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
