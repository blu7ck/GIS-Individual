import React, { useRef, useState } from 'react';
import { Upload, FileBox, FolderUp, Loader2 } from 'lucide-react';
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // DXF için options hazırla
      let options: any = undefined;
      if (selectedType === LayerType.DXF) {
        if (dxfNoTransform) {
          // DXF zaten gerçek dünya koordinatlarında - transformasyon yapma
          options = {
            noTransform: true
          };
        } else {
          // Manuel referans noktası varsa kullan
          const lon = parseFloat(dxfReferenceLon);
          const lat = parseFloat(dxfReferenceLat);
          if (!isNaN(lon) && !isNaN(lat)) {
            options = {
              referencePoint: [lon, lat],
              autoCenter: false
            };
          }
        }
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

  return (
    <div className={`p-4 bg-[#1C1B19] rounded-lg border border-[#57544F] shadow-xl space-y-4 ${className || ''}`}>
      <h3 className="text-[#12B285] font-semibold mb-2 flex items-center">
        <Upload size={18} className="mr-2" /> Add Data
      </h3>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => setSelectedType(LayerType.KML)}
          className={`p-2 text-xs rounded border transition-colors ${selectedType === LayerType.KML ? 'border-[#EA580C] bg-[#EA580C]/10 text-[#EA580C]' : 'border-[#57544F] text-gray-400 hover:border-[#EA580C]/50 hover:text-white'}`}
        >
          KML / KMZ
        </button>
        <button
          onClick={() => setSelectedType(LayerType.TILES_3D)}
          className={`p-2 text-xs rounded border transition-colors ${selectedType === LayerType.TILES_3D ? 'border-[#12B285] bg-[#12B285]/10 text-[#12B285]' : 'border-[#57544F] text-gray-400 hover:border-[#12B285]/50 hover:text-white'}`}
        >
          3D Tiles (R2)
        </button>
        <button
          onClick={() => setSelectedType(LayerType.DXF)}
          className={`p-2 text-xs rounded border transition-colors ${selectedType === LayerType.DXF ? 'border-[#EC4899] bg-[#EC4899]/10 text-[#EC4899]' : 'border-[#57544F] text-gray-400 hover:border-[#EC4899]/50 hover:text-white'}`}
        >
          DXF
        </button>
        <button
          onClick={() => setSelectedType(LayerType.SHP)}
          className={`p-2 text-xs rounded border transition-colors ${selectedType === LayerType.SHP ? 'border-[#06B6D4] bg-[#06B6D4]/10 text-[#06B6D4]' : 'border-[#57544F] text-gray-400 hover:border-[#06B6D4]/50 hover:text-white'}`}
        >
          Shapefile (ZIP)
        </button>
        <button
          onClick={() => setSelectedType(LayerType.GLB_UNCOORD)}
          className={`p-2 text-xs rounded border transition-colors ${selectedType === LayerType.GLB_UNCOORD ? 'border-[#A855F7] bg-[#A855F7]/10 text-[#A855F7]' : 'border-[#57544F] text-gray-400 hover:border-[#A855F7]/50 hover:text-white'}`}
        >
          GLB/GLTF (Model)
        </button>
      </div>

      {selectedType === LayerType.TILES_3D ? (
        <div className="space-y-4">
          {/* Option A: Upload Folder */}
          <div className="border border-dashed border-[#57544F] rounded p-3 bg-[#1C1B19]/50">
            <p className="text-xs text-gray-400 mb-2">Option 1: Upload Folder to R2</p>
            <input
              type="file"
              ref={folderInputRef}
              onChange={handleFolderChange}
              // @ts-ignore - React Types don't always fully support directory attributes yet
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              disabled={isUploading}
            />
            <Button
              onClick={() => folderInputRef.current?.click()}
              variant="primary"
              className="w-full"
              disabled={isUploading}
            >
              {isUploading ? (
                <span className="flex items-center">
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  {uploadProgress ? `Uploading (${uploadProgress})` : 'Uploading...'}
                </span>
              ) : (
                <>
                  <FolderUp size={16} className="mr-2" /> Select 3D Tiles Folder
                </>
              )}
            </Button>
            <p className="text-[10px] text-gray-500 mt-2 text-center">
              Select the folder containing <code>tileset.json</code> and all data files.
            </p>
          </div>

          {/* Option B: Manual Link */}
          <div className="border-t border-[#57544F] pt-3">
            <p className="text-xs text-gray-400 mb-2">Option 2: Enter Existing URL</p>
            <form onSubmit={handleUrlSubmit} className="flex space-x-2">
              <input
                type="text"
                className="flex-1 bg-[#1C1B19] border border-[#57544F] rounded p-2 text-xs text-white focus:border-[#12B285] focus:outline-none"
                placeholder="https://.../tileset.json"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                disabled={isUploading}
              />
              <Button type="submit" size="sm" variant="secondary" disabled={isUploading}>Load</Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* DXF için koordinat sistemi seçenekleri */}
          {selectedType === LayerType.DXF && (
            <div className="border border-[#57544F] rounded p-3 bg-[#1C1B19]/50 space-y-3">
              <p className="text-xs text-gray-400 font-semibold">
                Coordinate System
              </p>

              {/* Option 1: No Transformation (KML gibi) */}
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="dxf-coord-system"
                  checked={dxfNoTransform}
                  onChange={() => {
                    setDxfNoTransform(true);
                    setDxfReferenceLon('');
                    setDxfReferenceLat('');
                  }}
                  disabled={isUploading}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <span className="text-xs text-gray-300 block">Real-world coordinates (like KML)</span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    DXF is already in WGS84/UTM coordinates. Use as-is, no transformation.
                  </span>
                </div>
              </label>

              {/* Option 2: Manual Reference Point */}
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="dxf-coord-system"
                  checked={!dxfNoTransform}
                  onChange={() => setDxfNoTransform(false)}
                  disabled={isUploading}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <span className="text-xs text-gray-300 block">Local coordinates (manual positioning)</span>
                  <span className="text-[10px] text-gray-500 block mt-0.5 mb-2">
                    DXF uses local CAD coordinates. Enter reference point to position on map.
                  </span>

                  {!dxfNoTransform && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          className="w-full bg-[#1C1B19] border border-[#57544F] rounded p-2 text-xs text-white focus:border-[#12B285] focus:outline-none"
                          placeholder="35.0"
                          value={dxfReferenceLon}
                          onChange={(e) => setDxfReferenceLon(e.target.value)}
                          disabled={isUploading}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          className="w-full bg-[#1C1B19] border border-[#57544F] rounded p-2 text-xs text-white focus:border-[#12B285] focus:outline-none"
                          placeholder="39.0"
                          value={dxfReferenceLat}
                          onChange={(e) => setDxfReferenceLat(e.target.value)}
                          disabled={isUploading}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>
          )}

          <div className="relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={
                selectedType === LayerType.KML ? ".kml,.kmz" :
                  selectedType === LayerType.DXF ? ".dxf" :
                    selectedType === LayerType.SHP ? ".zip" :
                      ".glb,.gltf"
              }
              className="hidden"
              disabled={isUploading}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
              className={`w-full border-dashed ${selectedType === LayerType.KML
                ? 'bg-[#EA580C]/10 border-[#EA580C] text-[#EA580C] hover:bg-[#EA580C]/20'
                : selectedType === LayerType.DXF
                  ? 'bg-[#EC4899]/10 border-[#EC4899] text-[#EC4899] hover:bg-[#EC4899]/20'
                  : selectedType === LayerType.SHP
                    ? 'bg-[#06B6D4]/10 border-[#06B6D4] text-[#06B6D4] hover:bg-[#06B6D4]/20'
                    : selectedType === LayerType.GLB_UNCOORD
                      ? 'bg-[#A855F7]/10 border-[#A855F7] text-[#A855F7] hover:bg-[#A855F7]/20'
                      : 'bg-[#1C1B19] border-[#57544F] text-gray-300 hover:bg-[#57544F]/50'}`}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <FileBox size={16} className="mr-2" />}
              {isUploading ? (uploadProgress || 'Uploading...') :
                selectedType === LayerType.KML ? 'Select KML/KMZ File' :
                  selectedType === LayerType.DXF ? 'Select DXF File' :
                    selectedType === LayerType.SHP ? 'Select Shapefile ZIP' :
                      'Select GLB/GLTF File'}
            </Button>
            {selectedType === LayerType.SHP && (
              <p className="text-[10px] text-gray-500 mt-2 text-center">
                Upload a ZIP file containing .shp, .shx, .dbf, and optionally .prj files
              </p>
            )}
            {isUploading && uploadProgressPercent > 0 && (
              <div className="mt-2">
                <div className="w-full bg-[#1C1B19] rounded-full h-1.5 overflow-hidden border border-[#57544F]">
                  <div
                    className="bg-[#12B285] h-full transition-all duration-300"
                    style={{ width: `${uploadProgressPercent}%` }}
                  />
                </div>
                <div className="text-[10px] text-gray-400 mt-1 text-center">{Math.round(uploadProgressPercent)}%</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};