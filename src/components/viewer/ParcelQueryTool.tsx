import React, { useState, useCallback } from 'react';
import {
    Search, History, Save, MapPin, ChevronDown,
    Trash2, Crosshair, FileText, Download, Loader2, AlertTriangle, Info
} from 'lucide-react';
import { ToolbarItem } from '../ui/ToolbarItem';
import { PerformanceMode } from '../../types';
import type { ParcelResult, AdminHierarchyNode, SavedParcelQuery, ParcelQueryInput } from '../../shared/parcel/types';


// ============================================================================
// TYPES
// ============================================================================

interface Props {
    isOpen: boolean;
    onToggle: () => void;
    performanceMode?: PerformanceMode;

    // From useParcelQuery hook
    isLoading: boolean;
    error: string | null;
    currentResult: ParcelResult | null;
    isQueryMode: boolean;
    setIsQueryMode: (v: boolean) => void;
    setCurrentResult: (v: ParcelResult | null) => void;

    // Administrative hierarchy
    provinces: AdminHierarchyNode[];
    districts: AdminHierarchyNode[];
    neighborhoods: AdminHierarchyNode[];
    fetchDistricts: (ilId: number | string) => void;
    fetchNeighborhoods: (ilceId: number | string) => void;

    // Actions
    executeQuery: (input: ParcelQueryInput) => Promise<ParcelResult | null | undefined>;
    onSaveSelection: (result: ParcelResult, name: string, projectId?: string) => void;
    deleteSaved: (id: string) => void;
    flyToParcel: (result: ParcelResult | SavedParcelQuery) => void;
    onExportKml: (result: ParcelResult, name: string) => void;
    clearResult: () => void;

    // History
    sessionHistory: ParcelResult[];
    savedQueries: SavedParcelQuery[];

    // Context
    selectedProjectId?: string | null;
}

type TabType = 'query' | 'history';
type QueryMethod = 'click' | 'form';

// ============================================================================
// SUB‑COMPONENT: Result Card
// ============================================================================

const ResultCard: React.FC<{
    result: ParcelResult;
    onSave?: (name: string) => void;
    onFly: () => void;
    onExportKml?: (name: string) => void;
    selectedProjectId?: string | null;
    onShowParcelDetail?: (data: ParcelResult) => void;
    isSaved?: boolean;
}> = ({ result, onSave, onFly, onExportKml, onShowParcelDetail, isSaved }) => {
    const [saved, setSaved] = useState(isSaved || false);

    const props = result.feature.properties;
    const { metrics } = result;


    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
            {/* Header: Ada / Parsel */}
            <div className="flex items-center justify-between">
                <div>
                    <span className="text-orange-400 font-bold text-sm">{props.adaNo}/{props.parselNo}</span>
                    <span className="text-gray-500 text-[10px] ml-2">{props.mahalleAd}</span>
                </div>
                <button onClick={onFly} className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1" title="Parsele uç">
                    <Crosshair size={12} /> Uç
                </button>
            </div>

            {/* Quick Info Grid */}
            <div className="grid grid-cols-2 gap-2">
                <InfoCell label="İl / İlçe" value={`${props.ilAd || '—'} / ${props.ilceAd || '—'}`} />
                <InfoCell label="Nitelik" value={props.nitelik || '—'} />
                <InfoCell label="Alan" value={`${metrics.area_m2.toFixed(1)} m²`} />
                <InfoCell label="Çevre" value={`${metrics.perimeter_m.toFixed(1)} m`} />
                {result.elevation && (
                    <>
                        <InfoCell label="Min Rakım" value={`${result.elevation.min_m.toFixed(1)} m`} />
                        <InfoCell label="Max Rakım" value={`${result.elevation.max_m.toFixed(1)} m`} />
                    </>
                )}
                {metrics.aspect_deg !== undefined && (
                    <InfoCell label="Bakı" value={`${metrics.aspect_deg.toFixed(0)}°`} />
                )}
                {metrics.solar_exposure && (
                    <InfoCell label="Güneş" value={metrics.solar_exposure} />
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1 flex-wrap">
                {!saved ? (
                    <ActionBtn
                        icon={<Save size={14} />}
                        label="Kaydet"
                        color="#22C55E"
                        onClick={() => {
                            const defaultName = `${props.adaNo}/${props.parselNo}`;
                            onSave?.(defaultName);
                            setSaved(true);
                        }}
                    />
                ) : (
                    <ActionBtn icon={<Download size={14} />} label="KML" color="#3B82F6"
                        onClick={() => onExportKml?.(`${props.adaNo}_${props.parselNo}`)}
                    />
                )}

                {/* Info Button - Positioned next to download if saved, or at end if not */}
                <ActionBtn icon={<Info size={14} />} label="Detay" color="#EAB308" onClick={() => onShowParcelDetail?.(result)} />
            </div>
        </div>
    );
};

const InfoCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="bg-white/5 rounded-xl px-3 py-2">
        <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
        <div className="text-[11px] text-white font-medium truncate" title={value}>{value}</div>
    </div>
);

const ActionBtn: React.FC<{ icon: React.ReactNode; label: string; color: string; onClick: () => void }> = ({ icon, label, color, onClick }) => (
    <button
        onClick={onClick}
        style={{ borderColor: `${color}40`, color }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider hover:bg-white/5 transition-all whitespace-nowrap"
    >
        {icon} {label}
    </button>
);

// ============================================================================
// SUB‑COMPONENT: Admin Query Form
// ============================================================================

const AdminQueryForm: React.FC<{
    provinces: AdminHierarchyNode[];
    districts: AdminHierarchyNode[];
    neighborhoods: AdminHierarchyNode[];
    onProvinceChange: (id: number) => void;
    onDistrictChange: (id: number) => void;
    onSubmit: (input: ParcelQueryInput) => void;
    isLoading: boolean;
}> = ({ provinces, districts, neighborhoods, onProvinceChange, onDistrictChange, onSubmit, isLoading }) => {
    const [selectedProvince, setSelectedProvince] = useState<number | ''>('');
    const [selectedDistrict, setSelectedDistrict] = useState<number | ''>('');
    const [selectedNeighborhood, setSelectedNeighborhood] = useState<number | ''>('');
    const [adaNo, setAdaNo] = useState('');
    const [parselNo, setParselNo] = useState('');

    const handleSubmit = () => {
        if (!selectedNeighborhood || !adaNo || !parselNo) return;
        onSubmit({ mode: 'by_admin', mahalleId: selectedNeighborhood, adaNo, parselNo });
    };

    const selectClass = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/50 appearance-none";

    return (
        <div className="space-y-2.5">
            {/* Province */}
            <div className="relative">
                <select
                    className={selectClass}
                    value={selectedProvince}
                    onChange={e => {
                        const id = Number(e.target.value);
                        setSelectedProvince(id);
                        setSelectedDistrict('');
                        setSelectedNeighborhood('');
                        if (id) onProvinceChange(id);
                    }}
                >
                    <option value="">İl seçin...</option>
                    {provinces.map(p => <option key={p.id} value={p.id}>{p.text}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-2.5 text-gray-500 pointer-events-none" />
            </div>

            {/* District */}
            <div className="relative">
                <select
                    className={selectClass}
                    value={selectedDistrict}
                    disabled={!districts.length}
                    onChange={e => {
                        const id = Number(e.target.value);
                        setSelectedDistrict(id);
                        setSelectedNeighborhood('');
                        if (id) onDistrictChange(id);
                    }}
                >
                    <option value="">İlçe seçin...</option>
                    {districts.map(d => <option key={d.id} value={d.id}>{d.text}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-2.5 text-gray-500 pointer-events-none" />
            </div>

            {/* Neighborhood */}
            <div className="relative">
                <select
                    className={selectClass}
                    value={selectedNeighborhood}
                    disabled={!neighborhoods.length}
                    onChange={e => setSelectedNeighborhood(Number(e.target.value))}
                >
                    <option value="">Mahalle seçin...</option>
                    {neighborhoods.map(n => <option key={n.id} value={n.id}>{n.text}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-2.5 text-gray-500 pointer-events-none" />
            </div>

            {/* Ada / Parsel */}
            <div className="grid grid-cols-2 gap-2">
                <input
                    value={adaNo}
                    onChange={e => setAdaNo(e.target.value)}
                    placeholder="Ada No"
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                />
                <input
                    value={parselNo}
                    onChange={e => setParselNo(e.target.value)}
                    placeholder="Parsel No"
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                />
            </div>

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={!selectedNeighborhood || !adaNo || !parselNo || isLoading}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Sorgula
            </button>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ParcelQueryTool: React.FC<Props> = ({
    isOpen,
    onToggle,
    performanceMode,
    isLoading,
    error,
    currentResult,
    isQueryMode,
    setIsQueryMode,
    setCurrentResult,
    provinces,
    districts,
    neighborhoods,
    fetchDistricts,
    fetchNeighborhoods,
    executeQuery,
    onSaveSelection,
    deleteSaved,
    flyToParcel,
    clearResult,
    sessionHistory,
    savedQueries,
    selectedProjectId,
    onExportKml,
    onShowParcelDetail,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('query');
    const [queryMethod, setQueryMethod] = useState<QueryMethod>('click');
    // const [modalData, setModalData] = useState<ParcelResult | null>(null); // Removed

    const handleNewQuery = useCallback(() => {
        clearResult();
        setActiveTab('query');
    }, [clearResult]);

    const handleSave = useCallback((name: string) => {
        if (currentResult) {
            onSaveSelection(currentResult, name, selectedProjectId || undefined);
        }
    }, [currentResult, onSaveSelection, selectedProjectId]);

    return (
        <>
            <ToolbarItem
                icon={<Search size={20} />}
                label="PARSEL SORGU"
                isOpen={isOpen}
                onToggle={onToggle}
                isActive={isQueryMode}
                performanceMode={performanceMode}
            >
                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-white/5 rounded-2xl p-1">
                    <TabButton active={activeTab === 'query'} onClick={() => setActiveTab('query')} icon={<Search size={13} />} label="Sorgu" />
                    <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={13} />} label="Geçmiş" />
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-3 text-red-400 text-[11px]">
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}

                {/* ========== TAB: QUERY ========== */}
                {activeTab === 'query' && (
                    <div className="space-y-3">
                        {/* If result is showing, display result card */}
                        {currentResult ? (
                            <ResultCard
                                result={currentResult}
                                onSave={handleSave}
                                onFly={() => flyToParcel(currentResult)}
                                onExportKml={(name) => onExportKml(currentResult, name)}
                                selectedProjectId={selectedProjectId}
                                onShowParcelDetail={(data) => onShowParcelDetail?.(data)}
                            />
                        ) : (
                            <>
                                {/* Query Method Selector */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => { setQueryMethod('click'); setIsQueryMode(true); }}
                                        className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-all text-[11px] font-bold uppercase tracking-tight ${queryMethod === 'click'
                                            ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
                                            : 'border-white/5 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        <MapPin size={16} className={queryMethod === 'click' ? 'text-orange-400' : ''} />
                                        Haritadan
                                    </button>
                                    <button
                                        onClick={() => { setQueryMethod('form'); setIsQueryMode(false); }}
                                        className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-all text-[11px] font-bold uppercase tracking-tight ${queryMethod === 'form'
                                            ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
                                            : 'border-white/5 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        <FileText size={16} className={queryMethod === 'form' ? 'text-orange-400' : ''} />
                                        Bilgi Gir
                                    </button>
                                </div>

                                {/* Map Click Mode */}
                                {queryMethod === 'click' && (
                                    <div className="text-center py-6 space-y-2">
                                        {isLoading ? (
                                            <Loader2 size={28} className="animate-spin mx-auto text-orange-400" />
                                        ) : (
                                            <>
                                                <Crosshair size={28} className="mx-auto text-orange-400 animate-pulse" />
                                                <p className="text-gray-400 text-[11px]">
                                                    Harita üzerinde bir noktaya tıklayın
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Form Mode */}
                                {queryMethod === 'form' && (
                                    <AdminQueryForm
                                        provinces={provinces}
                                        districts={districts}
                                        neighborhoods={neighborhoods}
                                        onProvinceChange={(id) => fetchDistricts(id)}
                                        onDistrictChange={(id) => fetchNeighborhoods(id)}
                                        onSubmit={(input) => executeQuery(input)}
                                        isLoading={isLoading}
                                    />
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ========== TAB: HISTORY ========== */}
                {activeTab === 'history' && (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                        {sessionHistory.length === 0 ? (
                            <p className="text-gray-500 text-[11px] text-center py-6">Henüz sorgu yapılmadı</p>
                        ) : (
                            sessionHistory.map((item, i) => {
                                const p = item.feature.properties;
                                const isSaved = savedQueries.some(sq => sq.query_key === item.query_key);
                                return (
                                    <div
                                        key={`${item.query_key}-${i}`}
                                        onClick={() => {
                                            setCurrentResult(item);
                                            setActiveTab('query');
                                            flyToParcel(item);
                                        }}
                                        className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-2xl px-4 py-3 transition-all group text-left cursor-pointer"
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-orange-400 font-bold text-xs">{p.adaNo}/{p.parselNo}</span>
                                                {isSaved && <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">KAYITLI</span>}
                                            </div>
                                            <span className="text-gray-500 text-[10px] block truncate">{p.mahalleAd} — {p.ilceAd}</span>
                                        </div>
                                        <div className="flex items-center gap-1 ml-2 shrink-0">
                                            <span className="text-gray-600 text-[9px] group-hover:text-gray-400 mr-1">{item.metrics.area_m2.toFixed(0)} m²</span>

                                            {/* History List Actions: Download and Detail */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onExportKml(item, `${p.adaNo}_${p.parselNo}`);
                                                }}
                                                className="p-1.5 hover:bg-blue-500/20 text-gray-600 hover:text-blue-400 rounded-lg transition-colors"
                                                title="KML İndir"
                                            >
                                                <Download size={14} />
                                            </button>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onShowParcelDetail?.(item);
                                                }}
                                                className="p-1.5 hover:bg-orange-500/20 text-gray-600 hover:text-orange-400 rounded-lg transition-colors"
                                                title="Detay Görüntüle"
                                            >
                                                <Info size={14} />
                                            </button>

                                            {isSaved && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const savedItem = savedQueries.find(sq => sq.query_key === item.query_key);
                                                        if (savedItem) deleteSaved(savedItem.id);
                                                    }}
                                                    className="p-1.5 hover:bg-red-500/20 text-gray-600 hover:text-red-400 rounded-lg transition-colors"
                                                    title="Kaydı sil"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* TKGM Warning */}
                <div className="mt-4 pt-3 border-t border-white/5">
                    <p className="text-[9px] text-gray-600 leading-relaxed">
                        ⚠️ TKGM API kullanım koşulları geçerlidir. Veriler bilgilendirme amaçlıdır.
                    </p>
                </div>
            </ToolbarItem>
        </>
    );
};

// Tab Button Helper
const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${active ? 'bg-white/10 text-orange-400' : 'text-gray-500 hover:text-gray-300'
            }`}
    >
        {icon} {label}
    </button>
);
