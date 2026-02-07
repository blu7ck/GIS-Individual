import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Layer } from '../../types';

interface Props {
  layer: Layer | null;
  onClose: () => void;
}

export const UncoordinatedModelViewer: React.FC<Props> = ({ layer, onClose }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState<number>(0); // 0-100
  const modelViewerRef = useRef<any>(null);

  useEffect(() => {
    // Reset states when layer changes
    setHasError(false);
    setIsLoading(true);
    setErrorMessage('');
    setLoadingProgress(0);
  }, [layer?.id, layer?.url]);

  if (!layer || (!layer.blobUrl && !layer.url)) return null;

  // Cast custom element to any to avoid TypeScript errors without polluting global JSX namespace
  const ModelViewer = 'model-viewer' as any;

  // Use URL if available, fallback to blobUrl
  const src = layer.url || layer.blobUrl;

  const handleLoad = useCallback(() => {
    console.log('Model loaded successfully');
    setLoadingProgress(100);
    setIsLoading(false);
    setHasError(false);
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
      const progressPercent = Math.min(100, Math.max(0, Math.round(progress * 100)));
      setLoadingProgress(progressPercent);

      // When progress reaches 100%, model is fully loaded
      if (progressPercent >= 100) {
        setIsLoading(false);
        setHasError(false);
      }
    } catch (err) {
      console.warn('Error handling progress event:', err);
    }
  }, []);

  // NOTE: Removed fetch-based progress tracking (trackDownloadProgress) because it was
  // conflicting with model-viewer's native progress events, causing the loading bar
  // to jump between values (e.g., 80% -> real value -> 80%)
  // model-viewer handles progress tracking internally and emits 'progress' events

  // Attach event listeners to model-viewer element for progress tracking
  useEffect(() => {
    if (!src || hasError) return;

    let cleanup: (() => void) | null | undefined = null;

    const setupListeners = (element: any) => {
      if (!element) return;

      element.addEventListener('progress', handleProgress);
      element.addEventListener('load', handleLoad);
      element.addEventListener('error', handleError);

      return () => {
        element.removeEventListener('progress', handleProgress);
        element.removeEventListener('load', handleLoad);
        element.removeEventListener('error', handleError);
      };
    };

    const modelViewer = modelViewerRef.current;
    if (!modelViewer) {
      // If ref not ready, try to find it in DOM
      const checkModelViewer = setInterval(() => {
        const found = document.querySelector('model-viewer') as any;
        if (found) {
          if (!modelViewerRef.current) {
            modelViewerRef.current = found;
          }
          cleanup = setupListeners(found);
          clearInterval(checkModelViewer);
        }
      }, 100);
      return () => {
        clearInterval(checkModelViewer);
        if (cleanup) cleanup();
      };
    }

    cleanup = setupListeners(modelViewer);

    return () => {
      if (cleanup) cleanup();
    };
  }, [src, hasError, handleProgress, handleLoad, handleError]);

  // Check if model-viewer reports loaded state (backup check)
  useEffect(() => {
    if (!src || hasError || !isLoading) return;

    const checkLoaded = setInterval(() => {
      const modelViewer = modelViewerRef.current || document.querySelector('model-viewer') as any;
      if (modelViewer?.loaded && isLoading) {
        setLoadingProgress(100);
        setIsLoading(false);
        setHasError(false);
        clearInterval(checkLoaded);
      }

      // Also check progress property if available (model-viewer internal state)
      if (modelViewer && typeof modelViewer.progress === 'number') {
        const progress = Math.min(100, Math.max(0, Math.round(modelViewer.progress * 100)));
        if (progress > loadingProgress) {
          setLoadingProgress(progress);
        }
        if (progress >= 100 && isLoading) {
          setIsLoading(false);
          clearInterval(checkLoaded);
        }
      }
    }, 200); // Check every 200ms for faster response

    return () => clearInterval(checkLoaded);
  }, [src, isLoading, hasError, loadingProgress]);

  // No timeout - let it load indefinitely until complete

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 w-[90vw] h-[85vh] rounded-xl border border-gray-700 shadow-2xl overflow-hidden relative flex flex-col">
        <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-emerald-400 font-bold text-lg">{layer.name}</h2>
            <p className="text-xs text-gray-400">3D Model Viewer - GLTF/GLB</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full text-gray-300 hover:text-white transition">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 relative bg-[#1a1a1a]">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a] z-20">
              <div className="text-center w-full max-w-md px-8">
                <Loader2 className="animate-spin text-emerald-400 mx-auto mb-6" size={48} />
                <p className="text-gray-300 text-lg mb-4 font-medium">Model yükleniyor...</p>
                <p className="text-xs text-gray-500 mb-6 truncate" title={layer.name}>{layer.name}</p>

                {/* Progress Bar */}
                <div className="w-full bg-gray-700 rounded-full h-3 mb-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out shadow-lg shadow-emerald-500/50"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>

                {/* Progress Percentage */}
                <p className="text-emerald-400 text-sm font-mono mb-2">{loadingProgress}%</p>

                {/* Loading Status */}
                {loadingProgress > 0 && loadingProgress < 100 && (
                  <p className="text-xs text-gray-500 mt-2">Dosya indiriliyor...</p>
                )}
                {loadingProgress === 0 && (
                  <p className="text-xs text-gray-500 mt-2">Başlatılıyor...</p>
                )}
              </div>
            </div>
          )}

          {hasError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a] z-20">
              <div className="text-center max-w-md p-8">
                <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
                <p className="text-red-400 text-lg mb-2">Model yüklenemedi</p>
                {errorMessage && (
                  <p className="text-gray-400 text-sm mb-4">{errorMessage}</p>
                )}
                <p className="text-xs text-gray-500 break-all">{src}</p>
                <button
                  onClick={() => {
                    setHasError(false);
                    setIsLoading(true);
                    setErrorMessage('');
                    setLoadingProgress(0);
                    // Force remount by updating key
                  }}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition"
                >
                  Tekrar Dene
                </button>
              </div>
            </div>
          ) : (
            <ModelViewer
              ref={modelViewerRef}
              key={`model-${layer.id}-${src}`}
              src={src}
              alt={layer.name}
              auto-rotate
              camera-controls
              shadow-intensity="1"
              exposure="1.2"
              environment-image="neutral"
              interaction-policy="allow-when-focused"
              tone-mapping="auto"
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#111',
                display: isLoading ? 'none' : 'block' // Hide until fully loaded
              }}
              // Additional props for better compatibility
              loading="eager" // lazy yerine eager - daha hızlı yükleme
              reveal="auto" // interaction yerine auto - otomatik göster
              ar={false} // AR kapalı
              ar-modes=""
            >
              <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-black/50 p-2 rounded pointer-events-none z-10">
                <div>Left Click: Rotate</div>
                <div>Right Click: Pan</div>
                <div>Scroll: Zoom</div>
                <div>Shift+Drag: Pan</div>
              </div>
            </ModelViewer>
          )}
        </div>
      </div>
    </div>
  );
};