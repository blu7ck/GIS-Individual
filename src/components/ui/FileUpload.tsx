import React, { useRef, useState } from 'react';
import { Upload, FolderUp, Loader2, Check } from 'lucide-react';
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
      case LayerType.KML: return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case LayerType.DXF: return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      case LayerType.SHP: return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case LayerType.TILES_3D: return 'bg-teal-500/20 text-teal-400 border-teal-500/30'; // Teal (Scarab)
      case LayerType.POTREE: return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      case LayerType.LAS: return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case LayerType.GLB_UNCOORD: return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getThemeColor = (type: LayerType) => {
    switch (type) {
      case LayerType.TILES_3D: return 'teal';
      case LayerType.POTREE: return 'indigo';
      case LayerType.LAS: return 'rose';
      default: return 'emerald';
    }
  };

  const TypeButton = ({ type, label, description }: { type: LayerType, label: string, description?: string }) => {
    const isSelected = selectedType === type;
    const baseClass = "relative flex flex-col items-start p-3 rounded-xl border transition-all duration-200 text-left hover:scale-[1.02] active:scale-[0.98]";
    const activeClass = getTypeColor(type) + " ring-1 ring-white/10 shadow-lg";
    const inactiveClass = "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200";

    return (
      <button
        onClick={() => setSelectedType(type)}
        className={`${baseClass} ${isSelected ? activeClass : inactiveClass}`}
      >
        <div className="flex items-center justify-between w-full mb-1">
          <span className="text-xs font-bold tracking-tight">{label}</span>
          {isSelected && <Check size={14} className="opacity-80" />}
        </div>
        {description && <span className="text-[10px] opacity-60 leading-tight">{description}</span>}
      </button>
    );
  };

  // Dynamic theme for upload section
  const theme = getThemeColor(selectedType);

  return (
    <div className={`space-y-6 ${className || ''}`}>

      {/* File Type Grid */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Asset Type</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <TypeButton type={LayerType.KML} label="KML / KMZ" description="Google Earth files" />
          <TypeButton type={LayerType.DXF} label="DXF / CAD" description="AutoCAD Drawings" />
          <TypeButton type={LayerType.SHP} label="Shapefile" description="ESRI Shape (.zip)" />
          <TypeButton type={LayerType.TILES_3D} label="3D Tiles" description="Cesium 3D Tilesets" />
          <TypeButton type={LayerType.POTREE} label="Octree" description="Processed Potree" />
          <TypeButton type={LayerType.LAS} label="LAS / LAZ" description="Lidar Point Cloud" />
          <TypeButton type={LayerType.GLB_UNCOORD} label="GLB / GLTF" description="3D Models" />
        </div>
      </div>

      {/* Dynamic Content Area */}
      <div className="bg-black/20 rounded-xl border border-white/10 p-4 min-h-[280px] flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">

        {/* LAS Options */}
        {selectedType === LayerType.LAS && (
          <div className={`mb-4 space-y-3 p-3 bg-${theme}-500/10 border border-${theme}-500/20 rounded-lg`}>
            <p className={`text-xs font-semibold text-${theme}-400 mb-2`}>Processing Mode</p>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex flex-col p-2 rounded border cursor-pointer transition-colors ${lasConversionMode === 'OCTREE' ? `bg-${theme}-500/20 border-${theme}-500/40` : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <input type="radio" name="las-mode" checked={lasConversionMode === 'OCTREE'} onChange={() => setLasConversionMode('OCTREE')} className={`accent-${theme}-500`} />
                  <span className="text-xs font-bold text-gray-200">Octree (Potree)</span>
                </div>
                <span className="text-[10px] text-gray-400 ml-5">High detail analysis & colorization.</span>
              </label>
              <label className={`flex flex-col p-2 rounded border cursor-pointer transition-colors ${lasConversionMode === 'TILES_3D' ? `bg-${theme}-500/20 border-${theme}-500/40` : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <input type="radio" name="las-mode" checked={lasConversionMode === 'TILES_3D'} onChange={() => setLasConversionMode('TILES_3D')} className={`accent-${theme}-500`} />
                  <span className="text-xs font-bold text-gray-200">3D Tiles</span>
                </div>
                <span className="text-[10px] text-gray-400 ml-5">Optimized for map context.</span>
              </label>
            </div>
          </div>
        )}

        {/* DXF Options */}
        {selectedType === LayerType.DXF && (
          <div className="mb-4 space-y-3 p-3 bg-pink-500/10 border border-pink-500/20 rounded-lg">
            <p className="text-xs font-semibold text-pink-400 mb-2">Coordinate System</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="radio" checked={dxfNoTransform} onChange={() => { setDxfNoTransform(true); setDxfReferenceLon(''); setDxfReferenceLat(''); }} className="accent-pink-500" />
                <div className="flex flex-col">
                  <span className="text-xs text-gray-300 group-hover:text-white transition-colors">Use Native Coordinates (WGS84/UTM)</span>
                  <span className="text-[10px] text-gray-500">Preserves original X/Y values. Use if your CAD is already georeferenced.</span>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="radio" checked={!dxfNoTransform} onChange={() => setDxfNoTransform(false)} className="accent-pink-500" />
                <div className="flex flex-col">
                  <span className="text-xs text-gray-300 group-hover:text-white transition-colors">Manual Georeference (Local CAD)</span>
                  <span className="text-[10px] text-gray-500">Shifts the drawing to center on a specific Lat/Lon. Best for local layouts (0,0 based).</span>
                </div>
              </label>

              {!dxfNoTransform && (
                <div className="grid grid-cols-2 gap-3 mt-2 pl-6 animate-in slide-in-from-top-2">
                  <div>
                    <label className="text-[10px] text-pink-400/80 mb-1 block">Longitude</label>
                    <input
                      type="number" step="any" placeholder="32.0"
                      className="w-full bg-black/40 border border-pink-500/30 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                      value={dxfReferenceLon} onChange={(e) => setDxfReferenceLon(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-pink-400/80 mb-1 block">Latitude</label>
                    <input
                      type="number" step="any" placeholder="39.0"
                      className="w-full bg-black/40 border border-pink-500/30 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                      value={dxfReferenceLat} onChange={(e) => setDxfReferenceLat(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* DXF Preparation Tips */}
            <div className="mt-3 pt-3 border-t border-pink-500/20">
              <p className="text-[10px] font-semibold text-pink-400 mb-1">Preparation Tips:</p>
              <ul className="text-[10px] text-gray-400 list-disc list-inside space-y-0.5">
                <li><strong>Units:</strong> Ensure drawing units are in Meters.</li>
                <li><strong>Clean:</strong> Use <code>PURGE</code> and <code>AUDIT</code> commands in AutoCAD.</li>
                <li><strong>Simplify:</strong> <code>EXPLODE</code> complex blocks/regions into lines/polylines.</li>
                <li><strong>Version:</strong> Save as <strong>AutoCAD 2013/2018 DXF</strong> (ASCII).</li>
                <li><strong>Binary DXF</strong> is NOT supported.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Folder / URL Options for Complex Types */}
        {(selectedType === LayerType.TILES_3D || selectedType === LayerType.POTREE) ? (
          <div className="space-y-4">
            {/* Option 1: Folder */}
            <div className="group border border-dashed border-white/20 hover:border-white/40 rounded-xl p-4 transition-all bg-white/5 hover:bg-white/10">
              <p className={`text-xs font-semibold text-gray-300 mb-2 flex items-center gap-2`}>
                <FolderUp size={14} className={`text-${theme}-400`} />
                Folder Upload
              </p>
              <input
                type="file" ref={folderInputRef} onChange={handleFolderChange}
                // @ts-ignore
                webkitdirectory="" directory="" multiple className="hidden" disabled={isUploading}
              />
              <Button
                onClick={() => folderInputRef.current?.click()}
                className={`w-full justify-center bg-${theme}-600/20 hover:bg-${theme}-600/30 text-${theme}-400 border-${theme}-500/30`}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 size={16} className="animate-spin mr-2" /> : <FolderUp size={16} className="mr-2" />}
                {isUploading ? 'Uploading...' : `Select ${selectedType === LayerType.POTREE ? 'Octree' : '3D Tiles'} Folder`}
              </Button>
              <p className="text-[10px] text-gray-500 mt-2 text-center">
                Ensure folder contains <code>{selectedType === LayerType.POTREE ? 'cloud.js/metadata.json' : 'tileset.json'}</code>
              </p>
            </div>

            {/* Divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-[10px] text-gray-500 uppercase">OR</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            {/* Option 2: URL */}
            <div>
              <p className="text-xs font-semibold text-gray-300 mb-2">External URL</p>
              <form onSubmit={handleUrlSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://example.com/tileset.json"
                  className={`flex-1 bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-${theme}-500 transition-colors`}
                  value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} disabled={isUploading}
                />
                <Button type="submit" size="sm" variant="secondary" disabled={isUploading}>Load</Button>
              </form>
            </div>
          </div>
        ) : (
          /* Simple File Upload */
          <div className="space-y-4">
            <input
              type="file" ref={fileInputRef} onChange={handleFileChange}
              accept={
                selectedType === LayerType.KML ? ".kml,.kmz" :
                  selectedType === LayerType.DXF ? ".dxf" :
                    selectedType === LayerType.SHP ? ".zip" :
                      selectedType === LayerType.LAS ? ".las,.laz" :
                        ".glb,.gltf"
              }
              className="hidden" disabled={isUploading}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="lg"
              className={`w-full justify-center h-24 border-2 border-dashed flex-col gap-2 ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01]'
                } ${getTypeColor(selectedType)}`}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  <span className="text-sm font-medium">{uploadProgress || 'Uploading...'}</span>
                </>
              ) : (
                <>
                  <Upload size={24} />
                  <div className="text-center">
                    <span className="block text-sm font-bold">Click to Select File</span>
                    <span className="block text-[10px] opacity-70 mt-1">
                      {selectedType === LayerType.SHP ? 'Select .zip file' : `Select ${selectedType} file`}
                    </span>
                  </div>
                </>
              )}
            </Button>

            {/* Progress Bar */}
            {isUploading && uploadProgressPercent > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgressPercent)}%</span>
                </div>
                <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${uploadProgressPercent}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};