import React, { useRef, useState } from 'react';
import { Upload, FolderUp, Loader2 } from 'lucide-react';
import { Button } from '../common/Button';
import { LayerType } from '../../types';

interface FileUploadProps {
  onUpload: (file: File, type: LayerType, options?: any) => void;
  onFolderUpload: (files: FileList, type: LayerType) => void;
  onUrlAdd: (url: string, type: LayerType) => void;
  isUploading?: boolean;
  uploadProgress?: string; // e.g. "5/100" or "50%"
  uploadProgressPercent?: number; // 0-100 for progress bar
  className?: string;
}

// Static styles mapping for theme colors to avoid Tailwind purging dynamic strings
const themeStyles = {
  teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-400', accent: 'bg-teal-500', hover: 'hover:bg-teal-600/30' },
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400', accent: 'bg-indigo-500', hover: 'hover:bg-indigo-600/30' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', accent: 'bg-rose-500', hover: 'hover:bg-rose-600/30' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', accent: 'bg-orange-500', hover: 'hover:bg-orange-600/30' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-400', accent: 'bg-pink-500', hover: 'hover:bg-pink-600/30' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', accent: 'bg-cyan-500', hover: 'hover:bg-cyan-600/30' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', accent: 'bg-purple-500', hover: 'hover:bg-purple-600/30' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', accent: 'bg-emerald-500', hover: 'hover:bg-emerald-600/30' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', accent: 'bg-amber-500', hover: 'hover:bg-amber-600/30' },
} as const;

export const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  onFolderUpload,
  onUrlAdd,
  isUploading = false,
  uploadProgress,
  uploadProgressPercent = 0,
  className
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [selectedType, setSelectedType] = useState<LayerType>(LayerType.KML);
  const [manualUrl, setManualUrl] = useState('');

  // DXF için koordinat sistemi seçenekleri
  const [dxfNoTransform, setDxfNoTransform] = useState<boolean>(false);
  const [dxfReferenceLon, setDxfReferenceLon] = useState<string>('');
  const [dxfReferenceLat, setDxfReferenceLat] = useState<string>('');

  // GLB için koordinat sistemi seçenekleri
  const [glbGeoreferenced, setGlbGeoreferenced] = useState<boolean>(false);
  const [glbLon, setGlbLon] = useState<string>('');
  const [glbLat, setGlbLat] = useState<string>('');
  const [glbHeight, setGlbHeight] = useState<string>('0');

  // LAS için dönüşüm seçeneği
  const [lasConversionMode, setLasConversionMode] = useState<'OCTREE' | 'TILES_3D'>('OCTREE');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // DXF için options hazırla
      let options: any = undefined;
      if (selectedType === LayerType.DXF) {
        if (dxfNoTransform) {
          options = { noTransform: true };
        } else {
          const lon = parseFloat(dxfReferenceLon);
          const lat = parseFloat(dxfReferenceLat);
          if (!isNaN(lon) && !isNaN(lat)) {
            options = { referencePoint: [lon, lat], autoCenter: false };
          }
        }
      }

      // GLB için options hazırla
      if (selectedType === LayerType.GLB_UNCOORD && glbGeoreferenced) {
        const lon = parseFloat(glbLon);
        const lat = parseFloat(glbLat);
        const height = parseFloat(glbHeight) || 0;
        if (!isNaN(lon) && !isNaN(lat)) {
          options = { position: { lng: lon, lat, height } };
        }
      }

      // LAS için options hazırla
      if (selectedType === LayerType.LAS) {
        options = {
          conversionType: lasConversionMode // 'OCTREE' | 'TILES_3D'
        };
      }

      onUpload(file, selectedType, options);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFolderUpload(e.target.files, selectedType);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualUrl) {
      onUrlAdd(manualUrl, selectedType);
      setManualUrl('');
    }
  };

  const getTypeColor = (type: LayerType) => {
    switch (type) {
      case LayerType.KML: return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case LayerType.DXF: return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      case LayerType.SHP: return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case LayerType.TILES_3D: return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case LayerType.POTREE: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case LayerType.LAS: return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case LayerType.GLB_UNCOORD: return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getThemeColor = (type: LayerType) => {
    switch (type) {
      case LayerType.TILES_3D: return 'orange';
      case LayerType.POTREE: return 'emerald';
      case LayerType.LAS: return 'rose';
      case LayerType.KML: return 'amber';
      case LayerType.DXF: return 'pink';
      case LayerType.SHP: return 'cyan';
      case LayerType.GLB_UNCOORD: return 'purple';
      default: return 'emerald';
    }
  };

  // Theme properties for consistent UI
  const theme = getThemeColor(selectedType) as keyof typeof themeStyles;
  const currentTheme = themeStyles[theme] || themeStyles.emerald;

  const TypeButton = ({ type, label }: { type: LayerType, label: string }) => {
    const isSelected = selectedType === type;
    const baseClass = "relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-300 text-center hover:scale-[1.02] active:scale-[0.98]";
    const activeClass = `${getTypeColor(type)} ring-2 ring-white/10 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.4)] z-10 scale-[1.05]`;
    const inactiveClass = "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200";

    return (
      <button
        onClick={() => setSelectedType(type)}
        className={`${baseClass} ${isSelected ? activeClass : inactiveClass}`}
      >
        <span className={`text-[10px] sm:text-xs font-black tracking-widest uppercase ${isSelected ? 'text-white' : ''}`}>{label}</span>
      </button>
    );
  };

  const getActiveDescription = () => {
    switch (selectedType) {
      case LayerType.KML: return "Google Earth ve GIS platformlarından vektörel veriler.";
      case LayerType.DXF: return "AutoCAD çizimleri. ASCII metin formatında olmalıdır.";
      case LayerType.SHP: return ".shp, .dbf, .shx, .prj içeren bir .zip arşivi yükleyin.";
      case LayerType.TILES_3D: return "Optimize edilmiş 3D veri klasörü (tileset.json içermelidir).";
      case LayerType.POTREE: return "İşlenmiş nokta bulutu klasörü (metadata.json içermelidir).";
      case LayerType.LAS: return "Lidar verisi. Yüklendikten sonra bulutta işlenir.";
      case LayerType.GLB_UNCOORD: return "3D modeller ve objeler. Manuel konumlandırılabilir.";
      default: return "";
    }
  };

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* File Type Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-1">
          <div className="h-[1px] flex-grow bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] whitespace-nowrap">Veri Kaynağı Yapılandırması</label>
          <div className="h-[1px] flex-grow bg-gradient-to-r from-white/10 to-transparent"></div>
        </div>
        <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
          <TypeButton type={LayerType.KML} label="KML / KMZ" />
          <TypeButton type={LayerType.DXF} label="DXF / CAD" />
          <TypeButton type={LayerType.SHP} label="Shapefile" />
          <TypeButton type={LayerType.TILES_3D} label="3D Tiles" />
          <TypeButton type={LayerType.POTREE} label="Octree" />
          <TypeButton type={LayerType.LAS} label="LAS / LAZ" />
          <TypeButton type={LayerType.GLB_UNCOORD} label="GLB / GLTF" />
        </div>
      </div>

      {/* Info Bar */}
      <div className="flex items-center gap-4 px-6 py-4 bg-white/5 border border-white/5 rounded-2xl">
        <div className={`w-2 h-2 rounded-full ${currentTheme.accent} animate-pulse`} />
        <p className="text-xs font-medium text-white/50 italic">{getActiveDescription()}</p>
      </div>

      {/* Upload Notification */}
      {isUploading && (
        <div className="px-6 py-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="px-2 py-0.5 bg-blue-500/20 rounded text-[10px] font-bold text-blue-400 uppercase tracking-widest">İpucu</div>
          <p className="text-xs text-blue-100/70">Yükleme işlemi başladı. Bu pencereyi kapatabilirsiniz, arka planda devam edecektir.</p>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-8 min-h-[400px] flex flex-col shadow-inner">
        {/* LAS Options */}
        {selectedType === LayerType.LAS && (
          <div className="mb-4 space-y-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-rose-400">İşleme Modu</p>
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/20 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-rose-300 uppercase">Maks. 2GB Önerilir</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-all ${lasConversionMode === 'OCTREE' ? 'bg-rose-500/20 border-rose-500/30' : 'bg-black/20 border-white/5'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <input type="radio" checked={lasConversionMode === 'OCTREE'} onChange={() => setLasConversionMode('OCTREE')} className="accent-rose-500" />
                  <span className="text-xs font-bold">Octree (Potree)</span>
                </div>
                <span className="text-[10px] text-gray-400 ml-5">Detaylı analiz ve ölçüm için en iyisi.</span>
              </label>
              <div className="flex flex-col p-3 rounded-lg border border-white/5 bg-black/40 opacity-50 cursor-not-allowed">
                <span className="text-xs font-bold text-gray-500">3D Tiles (Yakında)</span>
              </div>
            </div>
          </div>
        )}

        {/* DXF Options */}
        {selectedType === LayerType.DXF && (
          <div className="mb-4 space-y-4 p-4 bg-pink-500/10 border border-pink-500/20 rounded-xl">
            <p className="text-xs font-semibold text-pink-400">Koordinat Sistemi Hizalaması</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-black/40 border border-white/5 cursor-pointer group hover:bg-black/60 transition-all">
                <input type="radio" checked={dxfNoTransform} onChange={() => { setDxfNoTransform(true); setDxfReferenceLon(''); setDxfReferenceLat(''); }} className="accent-pink-500" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-200">Gerçek Dünya</span>
                  <span className="text-[10px] text-gray-500">(WGS84/UTM) Orijinal koordinatlar.</span>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-black/40 border border-white/5 cursor-pointer group hover:bg-black/60 transition-all">
                <input type="radio" checked={!dxfNoTransform} onChange={() => setDxfNoTransform(false)} className="accent-pink-500" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-200">Manuel Konumlandır</span>
                  <span className="text-[10px] text-gray-500">Yerel (0,0) projeler için.</span>
                </div>
              </label>
            </div>
            {!dxfNoTransform && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <input type="number" placeholder="Boylam" className="bg-black/40 border border-pink-500/30 rounded p-2 text-xs" value={dxfReferenceLon} onChange={(e) => setDxfReferenceLon(e.target.value)} />
                <input type="number" placeholder="Enlem" className="bg-black/40 border border-pink-500/30 rounded p-2 text-xs" value={dxfReferenceLat} onChange={(e) => setDxfReferenceLat(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* GLB Options */}
        {selectedType === LayerType.GLB_UNCOORD && (
          <div className="mb-4 space-y-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={glbGeoreferenced} onChange={(e) => setGlbGeoreferenced(e.target.checked)} className="accent-purple-500" />
              <div className="flex flex-col">
                <span className="text-xs font-bold">Modeli Koordinatla</span>
                <span className="text-[10px] text-gray-500">Harita üzerinde nokta seçmek için. (low-poly modeller için önerilir)</span>
              </div>
            </label>
            {glbGeoreferenced && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <input type="number" placeholder="Boylam" className="bg-black/40 border border-purple-500/30 rounded p-2 text-xs" value={glbLon} onChange={(e) => setGlbLon(e.target.value)} />
                <input type="number" placeholder="Enlem" className="bg-black/40 border border-purple-500/30 rounded p-2 text-xs" value={glbLat} onChange={(e) => setGlbLat(e.target.value)} />
                <input type="number" placeholder="Yükseklik" className="bg-black/40 border border-purple-500/30 rounded p-2 text-xs col-span-2" value={glbHeight} onChange={(e) => setGlbHeight(e.target.value)} />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center">
          {/* Complex Upload (Folder/URL) */}
          {(selectedType === LayerType.TILES_3D || selectedType === LayerType.POTREE || selectedType === LayerType.GLB_UNCOORD) ? (
            <div className="space-y-6">
              <div className={`border border-dashed rounded-xl p-8 bg-white/5 ${currentTheme.border}`}>
                <p className={`text-xs font-bold mb-4 flex items-center gap-2 ${currentTheme.text}`}>
                  <FolderUp size={16} /> Klasör Yükle
                </p>
                <input type="file" ref={folderInputRef} onChange={handleFolderChange} webkitdirectory="" directory="" multiple className="hidden" disabled={isUploading} />
                <Button onClick={() => folderInputRef.current?.click()} className={`w-full justify-center py-6 ${currentTheme.bg} ${currentTheme.hover} ${currentTheme.text}`} disabled={isUploading}>
                  {isUploading ? <Loader2 size={18} className="animate-spin mr-3" /> : <FolderUp size={18} className="mr-3" />}
                  <span className="uppercase tracking-widest font-black text-xs">{isUploading ? 'Yükleniyor...' : 'Klasör Seç'}</span>
                </Button>
                <p className="text-[10px] text-gray-500 mt-4 text-center">Klasörün {selectedType === LayerType.POTREE ? 'metadata.json' : selectedType === LayerType.GLB_UNCOORD ? '.gltf (ve bin/textures)' : 'tileset.json'} içerdiğinden emin olun.</p>
              </div>

              {/* Single File Upload Option for GLB */}
              {selectedType === LayerType.GLB_UNCOORD && (
                <>
                  <div className="relative flex items-center">
                    <div className="flex-grow border-t border-white/5"></div>
                    <span className="mx-4 text-[10px] text-white/20 font-black tracking-widest uppercase">VEYA</span>
                    <div className="flex-grow border-t border-white/5"></div>
                  </div>

                  <div>
                    <input type="file" onChange={handleFileChange} accept=".glb,.gltf" className="hidden" id="glb-single-file" disabled={isUploading} />
                    <label htmlFor="glb-single-file" className={`w-full flex items-center justify-center p-4 rounded-xl border border-dashed border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer gap-3 text-gray-400 hover:text-white transition-all ${isUploading ? 'pointer-events-none opacity-50' : ''}`}>
                      <Upload size={18} />
                      <span className="uppercase tracking-widest font-bold text-xs">Tek Dosya (.glb) Yükle</span>
                    </label>
                  </div>
                </>
              )}

              <div className="relative flex items-center">
                <div className="flex-grow border-t border-white/5"></div>
                <span className="mx-4 text-[10px] text-white/20 font-black tracking-widest uppercase">VEYA</span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>

              <form onSubmit={handleUrlSubmit} className="flex gap-2">
                <input type="text" placeholder="Bağlantı URL'si girin..." className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-white/20" value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} disabled={isUploading} />
                <Button type="submit" variant="secondary" className="px-8 rounded-xl" disabled={isUploading}>Yükle</Button>
              </form>
            </div>
          ) : (
            /* Simple File Upload */
            <div className="space-y-4">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={selectedType === LayerType.KML ? ".kml,.kmz" : selectedType === LayerType.DXF ? ".dxf" : selectedType === LayerType.SHP ? ".zip" : selectedType === LayerType.LAS ? ".las,.laz" : ".glb,.gltf"} className="hidden" disabled={isUploading} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full h-20 border-2 border-dashed rounded-2xl flex items-center px-8 gap-6 transition-all ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 hover:scale-[1.005]'} ${getTypeColor(selectedType)}`}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest">{uploadProgress || 'Yükleniyor...'}</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} />
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-black uppercase tracking-[0.2em]">Dosya Seç</span>
                      <span className="text-[10px] opacity-40 font-bold uppercase">{selectedType === LayerType.SHP ? '.zip Formatında' : 'Doğrudan Seç ve Yükle'}</span>
                    </div>
                  </>
                )}
              </button>

              {isUploading && uploadProgressPercent > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    <span>Yükleme Durumu</span>
                    <span>%{Math.round(uploadProgressPercent)}</span>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${currentTheme.accent}`} style={{ width: `${uploadProgressPercent}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};