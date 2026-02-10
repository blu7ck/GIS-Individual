import React from 'react';
import { Gauge, Zap, Battery, Settings2, Sparkles } from 'lucide-react';
import { QualityLevel, PerformanceMode, QualitySettings, QUALITY_PRESETS } from '../../types';

interface Props {
    qualitySettings: QualitySettings;
    onQualityChange: (settings: QualitySettings) => void;
}

export const QualitySettingsPanel: React.FC<Props> = ({
    qualitySettings,
    onQualityChange
}) => {
    const QUALITY_LABELS: Record<QualityLevel, { label: string; icon: React.ReactNode; description: string; color: string; bg: string }> = {
        [QualityLevel.LOW]: {
            label: 'Düşük',
            icon: <Battery size={14} />,
            description: 'Pil tasarrufu, hızlı yükleme',
            color: '#EF4444', // Red
            bg: 'rgba(239, 68, 68, 0.15)'
        },
        [QualityLevel.MEDIUM]: {
            label: 'Orta',
            icon: <Settings2 size={14} />,
            description: 'Dengeli performans',
            color: '#06B6D4', // Scarab (Cyan/Teal)
            bg: 'rgba(6, 182, 212, 0.15)'
        },
        [QualityLevel.HIGH]: {
            label: 'Yüksek',
            icon: <Zap size={14} />,
            description: 'Güzel görüntü kalitesi',
            color: '#3B82F6', // Azure
            bg: 'rgba(59, 130, 246, 0.15)'
        },
        [QualityLevel.ULTRA]: {
            label: 'Ultra',
            icon: <Sparkles size={14} />,
            description: 'Maksimum kalite',
            color: '#FF00FF', // Neon Pink
            bg: 'rgba(255, 0, 255, 0.15)'
        }
    };

    const PERFORMANCE_LABELS: Record<PerformanceMode, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
        [PerformanceMode.BATTERY_SAVER]: {
            label: 'Pil Tasarrufu',
            icon: <Battery size={14} />,
            color: '#F97316', // Orange
            bg: 'rgba(249, 115, 22, 0.15)'
        },
        [PerformanceMode.BALANCED]: {
            label: 'Dengeli',
            icon: <Settings2 size={14} />,
            color: '#FACC15', // Saturated Yellow
            bg: 'rgba(250, 204, 21, 0.15)'
        },
        [PerformanceMode.HIGH_PERFORMANCE]: {
            label: 'Yüksek Performans',
            icon: <Zap size={14} />,
            color: '#FFFFFF', // Neon White
            bg: 'rgba(255, 255, 255, 0.15)'
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
        // Her zaman seçili Kalite Seviyesi'nin ana ayarlarından başlıyoruz
        const preset = QUALITY_PRESETS[qualitySettings.qualityLevel];
        let adjustedSettings = {
            ...qualitySettings,
            ...preset, // Preset değerlerini geri yüklüyoruz ki modlar arası geçişte değerler takılı kalmasın
            performanceMode: mode
        };

        if (mode === PerformanceMode.BATTERY_SAVER) {
            // Agresif pil tasarrufu - Preset değerlerinden daha kısıtlı hale getiriyoruz
            adjustedSettings = {
                ...adjustedSettings,
                maximumScreenSpaceError: Math.max(preset.maximumScreenSpaceError, 12),
                skipLevels: Math.max(preset.skipLevels, 3),
                cacheBytes: Math.min(preset.cacheBytes, 64 * 1024 * 1024),
                tileCacheSize: Math.min(preset.tileCacheSize, 200),
                textureCacheSize: Math.min(preset.textureCacheSize, 64)
            };
        } else if (mode === PerformanceMode.BALANCED) {
            // Dengeli mod - Preset değerlerinden orta seviye kısıtlama
            adjustedSettings = {
                ...adjustedSettings,
                maximumScreenSpaceError: Math.max(preset.maximumScreenSpaceError, 6),
                skipLevels: Math.max(preset.skipLevels, 1),
                cacheBytes: Math.min(preset.cacheBytes, 256 * 1024 * 1024),
                tileCacheSize: Math.min(preset.tileCacheSize, 500),
                textureCacheSize: Math.min(preset.textureCacheSize, 128)
            };
        }
        // HIGH_PERFORMANCE durumunda zaten preset değerleri (daha yukarıda yayılan) geçerli kalıyor.

        onQualityChange(adjustedSettings);
    };

    const handleSSEChange = (value: number) => {
        onQualityChange({
            ...qualitySettings,
            maximumScreenSpaceError: value
        });
    };

    const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);

    return (
        <div className="space-y-6">
            {/* Kalite Seviyesi */}
            <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Gauge size={14} />
                    KALİTE SEVİYESİ
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {Object.entries(QUALITY_LABELS).map(([level, { label, icon, description, color, bg }]) => (
                        <button
                            key={level}
                            onClick={() => handleQualityLevelChange(level as QualityLevel)}
                            style={qualitySettings.qualityLevel === level ? { backgroundColor: bg, borderColor: color, color: 'white', boxShadow: `0 0 15px ${bg}` } : {}}
                            className={`flex flex-col items-start p-3 rounded-2xl border-2 transition-all duration-300 text-left ${qualitySettings.qualityLevel === level
                                ? ''
                                : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <span className="flex items-center gap-2 text-sm font-bold">
                                <span style={{ color: qualitySettings.qualityLevel === level ? color : 'rgb(107, 114, 128)' }}>
                                    {icon}
                                </span>
                                {label}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-1 leading-tight">{description}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Performans Modu */}
            <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Zap size={14} />
                    PERFORMANS MODU
                </label>
                <div className="flex gap-2">
                    {Object.entries(PERFORMANCE_LABELS).map(([mode, { label, icon, color, bg }]) => (
                        <button
                            key={mode}
                            onClick={() => handlePerformanceModeChange(mode as PerformanceMode)}
                            style={qualitySettings.performanceMode === mode ? { backgroundColor: bg, borderColor: color, color: 'white', boxShadow: `0 0 15px ${bg}` } : {}}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl border-2 transition-all duration-300 text-xs font-bold ${qualitySettings.performanceMode === mode
                                ? ''
                                : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <span style={{ color: qualitySettings.performanceMode === mode ? color : 'rgb(107, 114, 128)' }}>
                                {icon}
                            </span>
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
                {qualitySettings.performanceMode === PerformanceMode.BATTERY_SAVER && (
                    <p className="text-[9px] text-orange-400/80 font-medium italic mt-2 text-center animate-in fade-in slide-in-from-top-1">
                        * Arayüz efektleri ve cam şeffaflığı performansı artırmak için devre dışı bırakıldı.
                    </p>
                )}
            </div>
            {/* Advanced Toggle */}
            <div className="pt-2">
                <button
                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                    className="w-full flex items-center justify-between py-3 px-4 rounded-2xl bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-widest"
                >
                    <span className="flex items-center gap-2">
                        <Settings2 size={14} className={isAdvancedOpen ? 'text-white' : ''} />
                        Gelişmiş Performans
                    </span>
                    <span className={`transition-transform duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`}>
                        ▼
                    </span>
                </button>

                {isAdvancedOpen && (
                    <div className="mt-4 space-y-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] animate-in slide-in-from-top-2 fade-in duration-300">
                        {/* 3D Tile Kalitesi (SSE) - Moved to Advanced */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Settings2 size={12} />
                                    3D TILE KESKİNLİĞİ (SSE)
                                </label>
                                <span className="text-white font-mono text-xs font-bold bg-white/5 px-2 py-0.5 rounded-full">
                                    {qualitySettings.maximumScreenSpaceError}px
                                </span>
                            </div>
                            <div className="space-y-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="16"
                                    step="1"
                                    value={qualitySettings.maximumScreenSpaceError}
                                    onChange={(e) => handleSSEChange(Number(e.target.value))}
                                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                                />
                                <div className="flex justify-between text-[10px] font-bold text-gray-600 uppercase tracking-tighter">
                                    <span>Maksimum Detay</span>
                                    <span>Maksimum Hız</span>
                                </div>
                            </div>
                        </div>

                        {/* LOD Skip Levels */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    LOD ATLAMA (SKIP LEVELS)
                                </label>
                                <span className="text-white font-mono text-xs font-bold">
                                    {qualitySettings.skipLevels}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="4"
                                step="1"
                                value={qualitySettings.skipLevels}
                                onChange={(e) => onQualityChange({ ...qualitySettings, skipLevels: Number(e.target.value) })}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                            />
                            <p className="text-[9px] text-gray-500 leading-normal italic">
                                * Yüksek değerler uzak modellerin detayını düşürerek FPS artırır.
                            </p>
                        </div>

                        {/* Cache Settings */}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    TILE CACHE
                                </label>
                                <div
                                    className="text-xs font-bold flex items-end gap-1 transition-colors duration-500"
                                    style={{ color: qualitySettings.tileCacheSize > 2000 ? '#F87171' : qualitySettings.tileCacheSize > 800 ? '#FBBF24' : '#38BDF8' }}
                                >
                                    {qualitySettings.tileCacheSize}
                                    <span className="text-[9px] text-gray-500 font-normal uppercase">Adet</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    TEXTURE CACHE
                                </label>
                                <div
                                    className="text-xs font-bold flex items-end gap-1 transition-colors duration-500"
                                    style={{ color: qualitySettings.textureCacheSize > 1024 ? '#F87171' : qualitySettings.textureCacheSize > 256 ? '#FBBF24' : '#38BDF8' }}
                                >
                                    {qualitySettings.textureCacheSize}
                                    <span className="text-[9px] text-gray-500 font-normal uppercase">MB</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                3D TILES BELLEK
                            </label>
                            <div
                                className="text-xs font-bold transition-colors duration-500"
                                style={{ color: qualitySettings.cacheBytes > 1024 * 1024 * 1024 ? '#F87171' : qualitySettings.cacheBytes > 256 * 1024 * 1024 ? '#FBBF24' : '#38BDF8' }}
                            >
                                {(qualitySettings.cacheBytes / (1024 * 1024)).toFixed(0)} MB
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-1000"
                                    style={{
                                        width: `${Math.min(100, (qualitySettings.cacheBytes / (2 * 1024 * 1024 * 1024)) * 100)}%`,
                                        backgroundColor: qualitySettings.cacheBytes > 1024 * 1024 * 1024 ? '#F87171' : qualitySettings.cacheBytes > 256 * 1024 * 1024 ? '#FBBF24' : '#38BDF8',
                                        boxShadow: `0 0 10px ${qualitySettings.cacheBytes > 256 * 1024 * 1024 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
