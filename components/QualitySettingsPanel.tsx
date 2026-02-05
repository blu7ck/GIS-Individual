import React from 'react';
import { Gauge, Zap, Battery, Settings2, Sparkles } from 'lucide-react';
import { QualityLevel, PerformanceMode, QualitySettings, QUALITY_PRESETS } from '../types';

interface Props {
    qualitySettings: QualitySettings;
    onQualityChange: (settings: QualitySettings) => void;
}

export const QualitySettingsPanel: React.FC<Props> = ({
    qualitySettings,
    onQualityChange
}) => {
    const QUALITY_LABELS: Record<QualityLevel, { label: string; icon: React.ReactNode; description: string }> = {
        [QualityLevel.LOW]: {
            label: 'Düşük',
            icon: <Battery size={14} />,
            description: 'Pil tasarrufu, hızlı yükleme'
        },
        [QualityLevel.MEDIUM]: {
            label: 'Orta',
            icon: <Settings2 size={14} />,
            description: 'Dengeli performans'
        },
        [QualityLevel.HIGH]: {
            label: 'Yüksek',
            icon: <Zap size={14} />,
            description: 'Güzel görüntü kalitesi'
        },
        [QualityLevel.ULTRA]: {
            label: 'Ultra',
            icon: <Sparkles size={14} />,
            description: 'Maksimum kalite'
        }
    };

    const PERFORMANCE_LABELS: Record<PerformanceMode, { label: string; icon: React.ReactNode }> = {
        [PerformanceMode.BATTERY_SAVER]: {
            label: 'Pil Tasarrufu',
            icon: <Battery size={14} />
        },
        [PerformanceMode.BALANCED]: {
            label: 'Dengeli',
            icon: <Settings2 size={14} />
        },
        [PerformanceMode.HIGH_PERFORMANCE]: {
            label: 'Yüksek Performans',
            icon: <Zap size={14} />
        }
    };

    const handleQualityLevelChange = (level: QualityLevel) => {
        const preset = QUALITY_PRESETS[level];
        onQualityChange({
            ...qualitySettings,
            qualityLevel: level,
            ...preset
        });
    };

    const handlePerformanceModeChange = (mode: PerformanceMode) => {
        // Performans moduna göre kalite ayarlarını güncelle
        let adjustedSettings = { ...qualitySettings, performanceMode: mode };

        if (mode === PerformanceMode.BATTERY_SAVER) {
            // Pil tasarrufu modunda kaliteyi düşür
            const lowPreset = QUALITY_PRESETS[QualityLevel.LOW];
            adjustedSettings = {
                ...adjustedSettings,
                maximumScreenSpaceError: Math.max(adjustedSettings.maximumScreenSpaceError, lowPreset.maximumScreenSpaceError / 2),
                skipLevels: Math.max(adjustedSettings.skipLevels, 2)
            };
        } else if (mode === PerformanceMode.HIGH_PERFORMANCE) {
            // Yüksek performans modunda preset değerlerine dön
            const preset = QUALITY_PRESETS[qualitySettings.qualityLevel];
            adjustedSettings = {
                ...adjustedSettings,
                ...preset
            };
        }

        onQualityChange(adjustedSettings);
    };

    const handleSSEChange = (value: number) => {
        onQualityChange({
            ...qualitySettings,
            maximumScreenSpaceError: value
        });
    };

    return (
        <div className="space-y-4">
            {/* Kalite Seviyesi */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Gauge size={12} />
                    Kalite Seviyesi
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(QUALITY_LABELS).map(([level, { label, icon, description }]) => (
                        <button
                            key={level}
                            onClick={() => handleQualityLevelChange(level as QualityLevel)}
                            className={`flex flex-col items-start p-2.5 rounded-lg border transition-all text-left ${qualitySettings.qualityLevel === level
                                ? 'bg-[#12B285]/20 border-[#12B285]/50 text-white'
                                : 'bg-black/20 border-[#57544F]/30 text-gray-300 hover:bg-white/5'
                                }`}
                            title={description}
                        >
                            <span className="flex items-center gap-1.5 text-sm font-medium">
                                <span className={qualitySettings.qualityLevel === level ? 'text-[#12B285]' : 'text-gray-500'}>
                                    {icon}
                                </span>
                                {label}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-0.5">{description}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Performans Modu */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap size={12} />
                    Performans Modu
                </label>
                <div className="flex gap-1">
                    {Object.entries(PERFORMANCE_LABELS).map(([mode, { label, icon }]) => (
                        <button
                            key={mode}
                            onClick={() => handlePerformanceModeChange(mode as PerformanceMode)}
                            className={`flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-lg border transition-all text-xs ${qualitySettings.performanceMode === mode
                                ? 'bg-[#12B285]/20 border-[#12B285]/50 text-white'
                                : 'bg-black/20 border-[#57544F]/30 text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            <span className={qualitySettings.performanceMode === mode ? 'text-[#12B285]' : 'text-gray-500'}>
                                {icon}
                            </span>
                            <span className="hidden sm:inline">{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 3D Tiles SSE Slider */}
            <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                        <Settings2 size={12} />
                        3D Tile Kalitesi
                    </span>
                    <span className="text-[#12B285] font-mono">
                        SSE: {qualitySettings.maximumScreenSpaceError}
                    </span>
                </label>
                <div className="relative">
                    <input
                        type="range"
                        min="0"
                        max="16"
                        step="1"
                        value={qualitySettings.maximumScreenSpaceError}
                        onChange={(e) => handleSSEChange(Number(e.target.value))}
                        className="w-full h-2 bg-[#57544F]/30 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-[#12B285]
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-[#12B285]
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>Yüksek Kalite</span>
                        <span>Hızlı Yükleme</span>
                    </div>
                </div>
                <p className="text-[10px] text-gray-500">
                    Düşük SSE = daha detaylı ama yavaş, Yüksek SSE = hızlı ama az detay
                </p>
            </div>
        </div>
    );
};
