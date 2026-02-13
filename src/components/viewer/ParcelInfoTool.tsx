import React from 'react';
import { Info, X } from 'lucide-react';
import { ToolbarItem } from '../ui/ToolbarItem';
import { PerformanceMode, AssetLayer } from '../../types';
import { ParcelMetrics, ParcelElevation } from '../../shared/parcel/types';

interface Props {
    activeAsset: AssetLayer | null;
    onClose: () => void;
    performanceMode?: PerformanceMode;
}

export const ParcelInfoTool: React.FC<Props> = ({ activeAsset, onClose, performanceMode }) => {
    // If no asset is active, don't render anything (or render hidden)
    if (!activeAsset) return null;

    const data = activeAsset.data as {
        isParcel: boolean;
        metrics: ParcelMetrics;
        properties: Record<string, any>;
        elevation?: ParcelElevation;
    };

    if (!data || !data.isParcel) return null;

    const { metrics, properties, elevation } = data;

    // Use Ada/Parsel from properties or asset name logic
    const title = `Ada: ${properties.adaNo} / Parsel: ${properties.parselNo}`;
    const subtitle = `${properties.mahalleAd || ''} - ${properties.ilceAd || ''}`;

    return (
        <ToolbarItem
            icon={<Info size={20} />}
            label="PARSEL BİLGİSİ"
            isOpen={true} // Always open when active? Or toggle? User said "bu butonun açacağı pencere".
            // If we want it to be a toggleable button that appears:
            // But usually if an info button appears, user clicks it to see info.
            // Let's assume it behaves like other tools.
            onToggle={onClose}
            isActive={true}
            performanceMode={performanceMode}
            className="animate-in slide-in-from-bottom-2 fade-in duration-300"
        >
            <div className="space-y-4 min-w-[300px]">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-white/10 pb-3">
                    <div>
                        <h3 className="text-orange-400 font-bold text-lg">{title}</h3>
                        <p className="text-gray-400 text-xs">{subtitle}</p>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 gap-2">
                    <InfoCell label="Nitelik" value={properties.nitelik || '—'} colSpan={2} />
                    <InfoCell label="Alan" value={`${metrics.area_m2.toFixed(2)} m²`} />
                    <InfoCell label="Çevre" value={`${metrics.perimeter_m.toFixed(2)} m`} />

                    {elevation && (
                        <>
                            <InfoCell label="Min Rakım" value={`${elevation.min_m.toFixed(1)} m`} />
                            <InfoCell label="Ort. Rakım" value={`${elevation.mean_m.toFixed(1)} m`} />
                        </>
                    )}

                    {/* Engineering */}
                    {metrics.aspect_deg !== undefined && (
                        <InfoCell label="Bakı" value={`${metrics.aspect_deg.toFixed(0)}°`} />
                    )}
                    {metrics.slope_deg !== undefined && (
                        <InfoCell label="Eğim" value={`%${(Math.tan(metrics.slope_deg * Math.PI / 180) * 100).toFixed(1)}`} />
                    )}

                    <InfoCell label="Güneşlenme" value={metrics.solar_exposure || '—'} colSpan={2} />
                </div>

                {/* Close Action */}
                <button
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
                >
                    <X size={14} /> Kapat
                </button>
            </div>
        </ToolbarItem>
    );
};

const InfoCell: React.FC<{ label: string; value: string; colSpan?: number }> = ({ label, value, colSpan }) => (
    <div className={`bg-white/5 rounded-xl px-3 py-2 ${colSpan ? `col-span-${colSpan}` : ''}`}>
        <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
        <div className="text-[12px] text-white font-medium truncate" title={value}>{value}</div>
    </div>
);
