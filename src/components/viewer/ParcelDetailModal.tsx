import React, { useState } from 'react';
import { X, Info, MapPin, Ruler, Mountain, Sun, FileText, Crosshair, Box } from 'lucide-react';
import { ParcelResult } from '../../shared/parcel/types';

interface ParcelDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: ParcelResult;
}

type TabType = 'general' | 'survey' | 'metrics' | 'raw';

export const ParcelDetailModal: React.FC<ParcelDetailModalProps> = ({
    isOpen,
    onClose,
    data
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('general');

    if (!isOpen) return null;

    const { feature, metrics, elevation } = data;
    const props = feature.properties;

    // Helper to format values
    const fmt = (val: any) => val !== undefined && val !== null ? String(val) : '—';
    const fmtNum = (val: number | undefined, digits = 2) => val !== undefined ? val.toFixed(digits) : '—';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-3xl bg-[#1e1e1e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5 bg-gradient-to-r from-orange-500/10 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-orange-500/20 rounded-xl">
                            <Info className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white tracking-tight">
                                Ada: {props.adaNo} / Parsel: {props.parselNo}
                            </h3>
                            <p className="text-sm text-white/50 font-medium">
                                {props.mahalleAd} - {props.ilceAd} / {props.ilAd}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-5 pt-4 border-b border-white/5 gap-6 overflow-x-auto no-scrollbar">
                    <TabButton
                        active={activeTab === 'general'}
                        onClick={() => setActiveTab('general')}
                        icon={<FileText size={16} />}
                        label="Genel"
                    />
                    <TabButton
                        active={activeTab === 'survey'}
                        onClick={() => setActiveTab('survey')}
                        icon={<Crosshair size={16} />}
                        label="Kadastro & Survey"
                    />
                    <TabButton
                        active={activeTab === 'metrics'}
                        onClick={() => setActiveTab('metrics')}
                        icon={<Ruler size={16} />}
                        label="Analiz"
                    />
                    <TabButton
                        active={activeTab === 'raw'}
                        onClick={() => setActiveTab('raw')}
                        icon={<Info size={16} />}
                        label="Ham Veri"
                    />
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 overflow-y-auto min-h-[400px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

                    {/* TAB: GENERAL */}
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <Section title="Konum Bilgileri" icon={<MapPin size={16} />}>
                                <div className="grid grid-cols-2 gap-4">
                                    <DetailRow label="İl" value={fmt(props.ilAd)} />
                                    <DetailRow label="İlçe" value={fmt(props.ilceAd)} />
                                    <DetailRow label="Mahalle" value={fmt(props.mahalleAd)} />
                                    <DetailRow label="Mevkii" value={fmt(props.mevkii)} />
                                </div>
                            </Section>

                            <Section title="Tapu Bilgileri" icon={<FileText size={16} />}>
                                <div className="grid grid-cols-2 gap-4">
                                    <DetailRow label="Ada No" value={fmt(props.adaNo)} />
                                    <DetailRow label="Parsel No" value={fmt(props.parselNo)} />
                                    <DetailRow label="Nitelik" value={fmt(props.nitelik)} className="col-span-2" />
                                    <DetailRow label="Pafta" value={fmt(props.pafta)} />
                                    <DetailRow label="Zemin ID" value={fmt(props.zeminId)} />
                                    <DetailRow label="Tapu Alanı" value={`${fmt(props.alan)} m²`} />
                                </div>
                            </Section>
                        </div>
                    )}

                    {/* TAB: SURVEY & GEOMETRY */}
                    {activeTab === 'survey' && (
                        <div className="space-y-6">
                            <Section title="Köşe Koordinatları" icon={<Crosshair size={16} />}>
                                <div className="overflow-x-auto rounded-xl border border-white/5">
                                    <table className="w-full text-left text-[11px]">
                                        <thead className="bg-white/5 text-gray-400 font-bold uppercase tracking-wider">
                                            <tr>
                                                <th className="px-3 py-2">No</th>
                                                <th className="px-3 py-2">Enlem / Boylam</th>
                                                <th className="px-3 py-2">UTM Easting</th>
                                                <th className="px-3 py-2">UTM Northing</th>
                                                <th className="px-3 py-2">Zone</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {metrics.verticesWgs84.map((v, i) => {
                                                const utm = metrics.verticesUtm?.[i];
                                                return (
                                                    <tr key={i} className="hover:bg-white/[0.02]">
                                                        <td className="px-3 py-2 text-orange-400 font-bold">{i + 1}</td>
                                                        <td className="px-3 py-2 text-white">{v.lat.toFixed(6)}, {v.lon.toFixed(6)}</td>
                                                        <td className="px-3 py-2 text-white/80">{utm ? utm.easting.toFixed(3) : '—'}</td>
                                                        <td className="px-3 py-2 text-white/80">{utm ? utm.northing.toFixed(3) : '—'}</td>
                                                        <td className="px-3 py-2 text-gray-500">{utm ? utm.zone : '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mt-2 text-[9px] text-gray-500 italic px-1">
                                    * UTM koordinatları yaklaşık hesaplanmıştır. Resmi ölçümler için kadastro verilerini kullanınız.
                                </p>
                            </Section>

                            <Section title="Kenar Ve Açı Ölçümleri" icon={<Ruler size={16} />}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Kenarlar</h4>
                                        <div className="space-y-1">
                                            {metrics.edges.map((e, i) => (
                                                <div key={i} className="flex items-center justify-between bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/5">
                                                    <span className="text-[10px] text-gray-400">{i + 1} - {i === metrics.edges.length - 1 ? 1 : i + 2}</span>
                                                    <span className="text-xs font-bold text-white">{e.length_m.toFixed(2)} m</span>
                                                    <span className="text-[10px] text-orange-500/60 bg-orange-500/10 px-1.5 py-0.5 rounded">{e.bearing_deg.toFixed(1)}°</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">İç Açılar</h4>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {metrics.edges.map((e, i) => (
                                                <div key={i} className="flex items-center justify-between bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/5">
                                                    <span className="text-[10px] text-gray-400">∠{i + 1}</span>
                                                    <span className="text-xs font-bold text-white">{e.angle_deg ? `${e.angle_deg.toFixed(1)}°` : '—'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Section>

                            <Section title="Sınır & Merkez" icon={<Box size={16} />}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Ağırlık Merkezi (Centroid)</div>
                                        <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-[10px] text-white/40">LON</span>
                                                <span className="text-xs text-white font-mono">{metrics.centroid.lon.toFixed(7)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-[10px] text-white/40">LAT</span>
                                                <span className="text-xs text-white font-mono">{metrics.centroid.lat.toFixed(7)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Bounding Box (WGS84)</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <BoxInfo label="KUZEY" value={metrics.bbox.maxLat.toFixed(6)} />
                                            <BoxInfo label="GÜNEY" value={metrics.bbox.minLat.toFixed(6)} />
                                            <BoxInfo label="DOĞU" value={metrics.bbox.maxLon.toFixed(6)} />
                                            <BoxInfo label="BATI" value={metrics.bbox.minLon.toFixed(6)} />
                                        </div>
                                    </div>
                                </div>
                            </Section>
                        </div>
                    )}

                    {/* TAB: METRICS */}
                    {activeTab === 'metrics' && (
                        <div className="space-y-6">
                            <Section title="Geometrik Ölçümler" icon={<Ruler size={16} />}>
                                <div className="grid grid-cols-2 gap-4">
                                    <DetailRow label="Hesaplanan Alan" value={`${fmtNum(metrics.area_m2)} m²`} />
                                    <DetailRow label="Çevre" value={`${fmtNum(metrics.perimeter_m)} m`} />
                                    <DetailRow label="Koordinat Sayısı" value={metrics.verticesWgs84?.length.toString() || '—'} />
                                </div>
                            </Section>

                            <Section title="Arazi Analizi" icon={<Mountain size={16} />}>
                                <div className="grid grid-cols-2 gap-4">
                                    {elevation ? (
                                        <>
                                            <DetailRow label="Minimum Rakım" value={`${fmtNum(elevation.min_m)} m`} />
                                            <DetailRow label="Maksimum Rakım" value={`${fmtNum(elevation.max_m)} m`} />
                                            <DetailRow label="Ortalama Rakım" value={`${fmtNum(elevation.mean_m)} m`} />
                                            <DetailRow label="Kot Farkı" value={`${fmtNum(elevation.max_m - elevation.min_m)} m`} />
                                        </>
                                    ) : (
                                        <div className="col-span-2 text-white/30 text-xs italic p-2 border border-white/5 rounded-lg">
                                            Arazi verisi bulunamadı veya hesaplanamadı.
                                        </div>
                                    )}
                                </div>
                            </Section>

                            <Section title="İleri Analiz" icon={<Sun size={16} />}>
                                <div className="grid grid-cols-2 gap-4">
                                    <DetailRow label="Bakı (Yön)" value={`${fmtNum(metrics.aspect_deg, 0)}°`} />
                                    <DetailRow label="Eğim" value={metrics.slope_deg ? `%${(Math.tan(metrics.slope_deg * Math.PI / 180) * 100).toFixed(1)} (${fmtNum(metrics.slope_deg, 1)}°)` : '—'} />
                                    <DetailRow label="Güneşlenme" value={metrics.solar_exposure || '—'} className="col-span-2" />
                                </div>
                            </Section>
                        </div>
                    )}

                    {/* TAB: RAW DATA */}
                    {activeTab === 'raw' && (
                        <div className="space-y-4">
                            <div className="bg-black/30 rounded-xl p-4 border border-white/5 overflow-x-auto">
                                <pre className="text-[11px] text-green-400 font-mono leading-relaxed">
                                    {JSON.stringify(props, null, 2)}
                                </pre>
                            </div>
                            <div className="text-white/40 text-xs italic">
                                * Bu veriler Tapu ve Kadastro Genel Müdürlüğü servislerinden ham olarak alınmıştır.
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 bg-white/[0.02] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all border border-white/5 active:scale-95"
                    >
                        Kapat
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Subcomponents ---

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`pb-3 px-1 flex items-center gap-2 text-sm font-medium transition-all relative shrink-0 ${active ? 'text-orange-500' : 'text-white/40 hover:text-white/60'
            }`}
    >
        {icon}
        {label}
        {active && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500 rounded-t-full" />
        )}
    </button>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 text-orange-400/80 text-[10px] font-bold uppercase tracking-wider">
            {icon} {title}
        </div>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            {children}
        </div>
    </div>
);

const DetailRow: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className = '' }) => (
    <div className={`space-y-1 ${className}`}>
        <div className="text-[9px] text-white/40 uppercase tracking-wider">{label}</div>
        <div className="text-sm text-white font-medium break-words">{value}</div>
    </div>
);

const BoxInfo: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-white/[0.03] p-1.5 rounded-lg border border-white/5">
        <div className="text-[8px] text-gray-500 font-bold mb-0.5">{label}</div>
        <div className="text-[10px] text-white font-mono">{value}</div>
    </div>
);
