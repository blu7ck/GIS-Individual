import React, { useState, useEffect, useMemo } from 'react';
import { Share2, X, Clock, Lock, Mail, CheckSquare, FileBox, Ruler, MessageCircle, Check, Copy } from 'lucide-react';
import { Project, AssetLayer, LayerType } from '../../types';

interface Props {
  project: Project;
  assets: AssetLayer[];
  measurements: AssetLayer[];
  onClose: () => void;
  onShare: (email: string, pin: string, hours: number, selectedAssetIds: string[]) => Promise<string>;
}

// Layer type badge color helper
function getTypeColor(type: LayerType): string {
  switch (type) {
    case LayerType.TILES_3D: return 'bg-violet-500/20 text-violet-300 border-violet-500/30';
    case LayerType.KML: return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case LayerType.GEOJSON: return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case LayerType.GLB_UNCOORD: return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case LayerType.POTREE: case LayerType.LAS: return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    case LayerType.ANNOTATION: return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
}

function getTypeLabel(type: LayerType): string {
  switch (type) {
    case LayerType.TILES_3D: return '3D Tiles';
    case LayerType.KML: return 'KML';
    case LayerType.GEOJSON: return 'GeoJSON';
    case LayerType.GLB_UNCOORD: return 'Model';
    case LayerType.POTREE: return 'Potree';
    case LayerType.LAS: return 'LAS';
    case LayerType.ANNOTATION: return 'Ölçüm';
    default: return type;
  }
}

// Measurement mode color — matches ProjectPanel.getMeasurementColor exactly
function getMeasurementBadge(mode?: string): { bg: string; text: string; border: string; hex: string } {
  const mapping: Record<string, string> = {
    'DISTANCE': '#FBBF24',
    'AREA': '#F97316',
    'SPOT_HEIGHT': '#D946EF',
    'SLOPE': '#84CC16',
    'LINE_OF_SIGHT': '#06B6D4',
    'CONVEX_HULL': '#A855F7',
    'PROFILE': '#3B82F6',
    'VOLUME': '#D97706',
    'DRAW_POLYGON': '#F97316',
  };
  const hex = mapping[mode || ''] || '#3B82F6';
  return {
    bg: `${hex}20`,
    text: hex,
    border: `${hex}50`,
    hex,
  };
}

function getMeasurementLabel(mode?: string): string {
  switch (mode) {
    case 'DISTANCE': return 'Mesafe';
    case 'AREA': return 'Alan';
    case 'SPOT_HEIGHT': return 'Nokta Yük.';
    case 'SLOPE': return 'Eğim';
    case 'LINE_OF_SIGHT': return 'Görüş Hattı';
    case 'CONVEX_HULL': return 'Zarf Alan';
    case 'PROFILE': return 'Kesit';
    case 'VOLUME': return 'Hacim';
    case 'DRAW_POLYGON': return 'Poligon';
    default: return 'Ölçüm';
  }
}

const DURATION_PRESETS = [
  { label: '1 Gün', value: 1 },
  { label: '3 Gün', value: 3 },
  { label: '7 Gün', value: 7 },
  { label: '14 Gün', value: 14 },
  { label: '30 Gün', value: 30 },
];

export const ShareProjectModal: React.FC<Props> = ({
  project,
  assets,
  measurements,
  onClose,
  onShare
}) => {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [duration, setDuration] = useState(7);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Auto-select all on load (only once)
  const hasInitialized = React.useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      const allIds = [...assets, ...measurements].map(a => a.id);
      setSelectedAssets(new Set(allIds));
      hasInitialized.current = true;
    }
  }, []); // Empty dependency array to run only on mount

  const toggleAsset = (id: string) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = [...assets, ...measurements].map(a => a.id);
    setSelectedAssets(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedAssets(new Set());
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedAssets.size === 0) {
      alert('Lütfen en az bir dosya veya ölçüm seçin');
      return;
    }

    if (!email || !pin) {
      alert('E-posta ve PIN alanlarını doldurun');
      return;
    }

    if (pin.length !== 6) {
      alert('PIN 6 haneli olmalıdır');
      return;
    }

    setIsLoading(true);
    try {
      const link = await onShare(email, pin, duration * 24, Array.from(selectedAssets));
      setGeneratedLink(link);
    } catch (error) {
      console.error('Share error:', error);
      alert('Paylaşım başarısız. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  const allSelected = useMemo(() => {
    const totalCount = assets.length + measurements.length;
    return totalCount > 0 && selectedAssets.size === totalCount;
  }, [assets.length, measurements.length, selectedAssets.size]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(
      `📦 Proje Paylaşımı: ${project.name}\n\n` +
      `🔗 Güvenli Bağlantı: ${generatedLink}\n` +
      `🔐 PIN: ${pin}\n\n` +
      `⏱ Son kullanım: ${duration} gün`
    );
    const whatsappUrl = isMobile
      ? `https://wa.me/?text=${message}`
      : `https://web.whatsapp.com/send?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = generatedLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const selectedFileCount = assets.filter(a => selectedAssets.has(a.id)).length;
  const selectedMeasurementCount = measurements.filter(m => selectedAssets.has(m.id)).length;

  // --- Render Helpers ---

  const renderAssetItem = (item: AssetLayer, isMeasurement = false) => {
    const isChecked = selectedAssets.has(item.id);
    const typeLabel = isMeasurement ? getMeasurementLabel(item.data?.mode) : getTypeLabel(item.type);

    // For measurements, use inline style with exact hex colors from ProjectPanel
    const measurementColors = isMeasurement ? getMeasurementBadge(item.data?.mode) : null;
    const typeColorClass = !isMeasurement ? getTypeColor(item.type) : '';

    return (
      <label
        key={item.id}
        className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 group border
          ${isChecked
            ? 'bg-white/[0.06] border-white/15 shadow-sm'
            : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/5'
          }`}
      >
        {/* Custom Checkbox */}
        <div
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0
            ${isChecked
              ? 'bg-cyan-500 border-cyan-500 shadow-lg shadow-cyan-500/30'
              : 'border-white/20 group-hover:border-white/40'
            }`}
          onClick={(e) => { e.preventDefault(); toggleAsset(item.id); }}
        >
          {isChecked && <Check size={12} className="text-white" strokeWidth={3} />}
        </div>

        {/* Name */}
        <span className={`text-[13px] flex-1 truncate transition-colors ${isChecked ? 'text-white font-medium' : 'text-gray-400 group-hover:text-gray-300'}`}>
          {item.name}
        </span>

        {/* Type Badge */}
        {measurementColors ? (
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border"
            style={{
              backgroundColor: measurementColors.bg,
              color: measurementColors.text,
              borderColor: measurementColors.border,
            }}
          >
            {typeLabel}
          </span>
        ) : (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${typeColorClass}`}>
            {typeLabel}
          </span>
        )}

        {/* Measurement value */}
        {isMeasurement && item.data?.text && (
          <span className="text-[10px] text-gray-500 font-mono max-w-[80px] truncate">
            {item.data.text}
          </span>
        )}
      </label>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] bg-[#0a0a0a]/95 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Share2 size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-white">Proje Paylaş</h3>
              <p className="text-[11px] text-gray-500 font-medium">{project.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 text-gray-500 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {!generatedLink ? (
            <form onSubmit={handleShare} className="p-6 space-y-5">

              {/* Email & PIN */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Alıcı E-posta *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
                    <input
                      type="email"
                      required
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-white placeholder-gray-600 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 outline-none transition-all"
                      placeholder="alici@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Erişim PIN *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={15} />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-white placeholder-gray-600 font-mono tracking-widest focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 outline-none transition-all"
                        placeholder="••••••"
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>

                  {/* Duration Preset Buttons */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                      <Clock size={11} className="inline mr-1" />Süre
                    </label>
                    <div className="flex gap-1">
                      {DURATION_PRESETS.map(preset => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setDuration(preset.value)}
                          className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all
                            ${duration === preset.value
                              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-sm shadow-cyan-500/10'
                              : 'bg-white/[0.02] border-white/5 text-gray-500 hover:text-gray-400 hover:bg-white/[0.04]'
                            }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/5" />

              {/* Asset Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Paylaşılacak İçerik</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-bold">
                      {selectedAssets.size}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={selectAll}
                      disabled={allSelected}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-gray-500 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                    >
                      Tümünü Seç
                    </button>
                    <button
                      type="button"
                      onClick={deselectAll}
                      disabled={selectedAssets.size === 0}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-gray-500 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
                    >
                      Temizle
                    </button>
                  </div>
                </div>

                {/* Files */}
                {assets.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <FileBox size={12} className="text-gray-600" />
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                        Dosyalar ({selectedFileCount}/{assets.length})
                      </span>
                    </div>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar bg-white/[0.015] rounded-xl p-1.5 border border-white/5">
                      {assets.map(asset => renderAssetItem(asset))}
                    </div>
                  </div>
                )}

                {/* Measurements */}
                {measurements.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Ruler size={12} className="text-gray-600" />
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                        Ölçümler ({selectedMeasurementCount}/{measurements.length})
                      </span>
                    </div>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar bg-white/[0.015] rounded-xl p-1.5 border border-white/5">
                      {measurements.map(m => renderAssetItem(m, true))}
                    </div>
                  </div>
                )}

                {assets.length === 0 && measurements.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="p-3 rounded-full bg-white/5 text-gray-600 mb-3">
                      <FileBox size={24} />
                    </div>
                    <p className="text-[12px] text-gray-600 font-medium">Bu projede paylaşılacak içerik bulunmuyor.</p>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || selectedAssets.size === 0}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-[13px] rounded-xl transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Bağlantı Oluşturuluyor...
                  </>
                ) : (
                  <>
                    <Share2 size={15} />
                    Paylaşım Bağlantısı Oluştur ({selectedAssets.size} öğe)
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Success State — minimal */
            <div className="p-6 space-y-4">
              {/* Success header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                  <CheckSquare size={20} />
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-white">Bağlantı Hazır!</h4>
                  <p className="text-[11px] text-gray-500">PIN: <span className="text-cyan-400 font-mono font-bold">{pin}</span> · {duration} gün geçerli</p>
                </div>
              </div>

              {/* Copy Link */}
              <button
                onClick={handleCopy}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${copied
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'
                  }`}
              >
                <div className={`p-2 rounded-lg flex-shrink-0 ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'}`}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-[12px] font-bold block ${copied ? 'text-emerald-400' : 'text-white'}`}>
                    {copied ? 'Kopyalandı!' : 'Bağlantıyı Kopyala'}
                  </span>
                  <span className="text-[10px] text-gray-600 font-mono truncate block">{generatedLink}</span>
                </div>
              </button>

              {/* WhatsApp */}
              <button
                onClick={handleWhatsAppShare}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] rounded-xl transition-all font-bold text-[12px] border border-[#25D366]/20"
              >
                <MessageCircle size={16} />
                WhatsApp ile Paylaş
              </button>

              <button
                onClick={onClose}
                className="w-full text-center text-[11px] text-gray-600 hover:text-gray-400 transition-colors py-1 font-medium"
              >
                Kapat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
