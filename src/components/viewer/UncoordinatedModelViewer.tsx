import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, AlertCircle, Info, MousePointer2, Box, Layers, Check } from 'lucide-react';
import { Layer } from '../../types';

interface Props {
  layers: Layer[];
  initialLayerId?: string;
  onClose: () => void;
}

export const UncoordinatedModelViewer: React.FC<Props> = ({ layers, initialLayerId, onClose }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const modelViewerRef = useRef<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Active Layer State
  const [activeLayer, setActiveLayer] = useState<Layer | null>(() => {
    if (layers.length === 0) return null;
    if (initialLayerId) {
      const found = layers.find(l => l.id === initialLayerId);
      if (found) return found;
    }
    return layers[0] ?? null;
  });

  // Update active layer if layers prop changes significantly
  useEffect(() => {
    if (!activeLayer && layers.length > 0) {
      setActiveLayer(layers[0] || null);
    }
  }, [layers]);

  useEffect(() => {
    // Reset states when layer changes
    setHasError(false);
    setIsLoading(true);
    setErrorMessage('');
    setLoadingProgress(0);
  }, [activeLayer?.id, activeLayer?.url]);

  if (!activeLayer || (!activeLayer.blobUrl && !activeLayer.url)) return null;

  // Cast custom element to any to avoid TypeScript errors
  const ModelViewer = 'model-viewer' as any;

  // Use URL if available, fallback to blobUrl
  const src = activeLayer.url || activeLayer.blobUrl;

  const handleLoad = useCallback(() => {
    setLoadingProgress(100);
    // Add small delay for smooth transition
    setTimeout(() => {
      setIsLoading(false);
      setHasError(false);
    }, 500);
  }, []);

  const handleError = useCallback((e: any) => {
    console.error('Model viewer error:', e);
    setIsLoading(false);
    setHasError(true);
    const errorMsg = e?.detail?.message || e?.message || e?.type || 'Model yüklenirken bir hata oluştu';
    setErrorMessage(errorMsg);
  }, []);

  // Handle progress updates from model-viewer
  const handleProgress = useCallback((e: any) => {
    try {
      const progress = e.detail?.totalProgress ?? 0;
      const progressPercent = Math.min(99, Math.max(0, Math.round(progress * 100)));

      setLoadingProgress((prev) => {
        // Progress should only go forward
        if (progressPercent > prev) return progressPercent;
        return prev;
      });

    } catch (err) {
      console.warn('Error handling progress event:', err);
    }
  }, []);

  useEffect(() => {
    if (!src || hasError) return;

    let cleanup: (() => void) | null | undefined = null;

    const setupListeners = (element: any) => {
      if (!element) return;

      const onProgress = (e: any) => handleProgress(e);
      const onLoad = () => handleLoad();
      const onError = (e: any) => handleError(e);

      element.addEventListener('progress', onProgress);
      element.addEventListener('load', onLoad);
      element.addEventListener('poster-dismissed', onLoad); // Mobile fallback
      element.addEventListener('error', onError);

      if (element.loaded) {
        handleLoad();
      }

      return () => {
        element.removeEventListener('progress', onProgress);
        element.removeEventListener('load', onLoad);
        element.removeEventListener('poster-dismissed', onLoad);
        element.removeEventListener('error', onError);
      };
    };

    const modelViewer = modelViewerRef.current;
    if (modelViewer) {
      cleanup = setupListeners(modelViewer);
    } else {
      const timeout = setTimeout(() => {
        const found = document.querySelector('model-viewer') as any;
        if (found && !cleanup) {
          cleanup = setupListeners(found);
        }
      }, 500);
      return () => clearTimeout(timeout);
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [src, hasError, handleProgress, handleLoad, handleError]);

  // Smoother progress bar when it sticks at high values (before load)
  useEffect(() => {
    if (isLoading && loadingProgress >= 90 && loadingProgress < 99) {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev < 99) return prev + 0.1;
          return prev;
        });
      }, 200);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isLoading, loadingProgress]);

  return (
    <div className="fixed inset-0 z-50 flex flex-row bg-black/90 backdrop-blur-md animate-in fade-in duration-300">

      {/* Sidebar for Multiple Layers */}
      {layers.length > 1 && (
        <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-black/80 backdrop-blur-xl border-r border-white/10 transition-all duration-300 flex flex-col overflow-hidden z-[60] h-full`}>
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/70">
              <Layers size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Modeller</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {layers.map(layer => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${activeLayer?.id === layer.id
                  ? 'bg-carta-gold-500/20 text-carta-gold-400 border border-carta-gold-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <span className="truncate flex-1">{layer.name}</span>
                {activeLayer?.id === layer.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 relative h-full flex flex-col p-4 md:p-8">

        {/* Toggle Sidebar Button */}
        {layers.length > 1 && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute top-8 left-8 z-[60] p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg text-white/70 hover:text-white transition-all"
          >
            <Layers size={20} />
          </button>
        )}

        <div className="bg-[#111] w-full h-full rounded-2xl border border-carta-gold-500/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative flex flex-col">
          {/* Header */}
          <div className={`bg-[#1a1a1a]/80 backdrop-blur-sm p-4 border-b border-white/5 flex justify-between items-center z-30 transition-all ${layers.length > 1 && sidebarOpen ? 'pl-2' : ''}`}>
            <div className={`flex items-center gap-3 ${layers.length > 1 ? 'pl-12' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-carta-gold-500/10 flex items-center justify-center border border-carta-gold-500/20">
                <Box className="text-carta-gold-500" size={20} />
              </div>
              <div>
                <h2 className="text-white font-bold tracking-tight">{activeLayer.name}</h2>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-carta-gold-500 animate-pulse" />
                  3D Model Viewer • CartaX Precision
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-all transform hover:rotate-90"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 relative bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a]">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-20">
                <div className="text-center w-full max-w-sm px-8 relative">
                  <div className="relative mb-8 flex justify-center">
                    <div className="absolute inset-0 bg-carta-gold-500/20 blur-2xl rounded-full" />
                    <Loader2 className="animate-spin text-carta-gold-500 relative" size={48} />
                  </div>

                  <p className="text-white text-lg mb-2 font-bold tracking-tight">Model Hazırlanıyor</p>
                  <p className="text-[11px] text-gray-500 mb-8 truncate uppercase tracking-widest">{activeLayer.name}</p>

                  {/* Modern Progress Bar */}
                  <div className="w-full bg-white/5 rounded-full h-1.5 mb-3 overflow-hidden relative">
                    <div
                      className="bg-carta-gold-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-gray-500 font-mono uppercase">Yükleniyor</span>
                    <span className="text-carta-gold-500 text-sm font-mono font-bold leading-none">{Math.floor(loadingProgress)}%</span>
                  </div>
                </div>
              </div>
            )}

            {hasError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-20">
                <div className="text-center max-w-md p-8 bg-black/40 rounded-3xl border border-red-500/20 backdrop-blur-xl">
                  <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                    <AlertCircle className="text-red-500" size={32} />
                  </div>
                  <h3 className="text-white text-xl font-bold mb-3">Model yüklenemedi</h3>
                  {errorMessage && (
                    <p className="text-gray-400 text-sm mb-6 leading-relaxed">{errorMessage}</p>
                  )}
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => {
                        setHasError(false);
                        setIsLoading(true);
                        setErrorMessage('');
                        setLoadingProgress(0);
                      }}
                      className="px-6 py-3 bg-carta-gold-500 hover:bg-carta-gold-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-carta-gold-900/20"
                    >
                      Tekrar Dene
                    </button>
                    <button
                      onClick={onClose}
                      className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl font-medium transition-all"
                    >
                      Kapat
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full relative cursor-grab active:cursor-grabbing">
                <ModelViewer
                  ref={modelViewerRef}
                  key={`model-${activeLayer.id}-${src}`}
                  src={src}
                  alt={activeLayer.name}
                  auto-rotate
                  camera-controls
                  shadow-intensity="2"
                  shadow-softness="1"
                  exposure="1.0"
                  environment-image="neutral"
                  interaction-policy="always-allow"
                  tone-mapping="neutral"
                  style={{
                    width: '100%',
                    height: '100%',
                    display: isLoading ? 'none' : 'block',
                    touchAction: 'none'
                  }}
                  loading="eager"
                  reveal="auto"
                  ar={false}
                >
                  {/* Controls Info */}
                  <div className="absolute bottom-6 left-6 z-10 flex flex-col gap-2">
                    <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-2xl pointer-events-none group transition-all duration-300 hover:border-carta-gold-500/40">
                      <div className="flex items-center gap-2 mb-3 text-carta-gold-500">
                        <MousePointer2 size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Kontroller</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
                        <div className="flex items-center gap-2 text-gray-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                          <span>Sol Tık : Döndürme</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                          <span>Sağ Tık : Kaydırma</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                          <span>Tekerlek : Yakınlaştır</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                          <span>Shift+Sürükle : Kaydır</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Model Stats / Credits if any */}
                  <div className="absolute top-6 right-6 z-10 hidden md:block">
                    <div className="bg-black/40 backdrop-blur-sm border border-white/5 px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px] text-gray-500">
                      <Info size={12} />
                      <span>PBR Rendering Active</span>
                    </div>
                  </div>
                </ModelViewer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};