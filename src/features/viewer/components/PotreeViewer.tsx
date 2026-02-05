import React, { useRef, useEffect, useState } from 'react';
import { X, Settings, Layers, Box, Maximize2, Move, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { AssetLayer, AssetStatus } from '../../../../types';

interface PotreeViewerProps {
    layer: AssetLayer;
    onClose: () => void;
}

/**
 * PotreeViewer - Advanced Point Cloud Analysis Tool
 * This viewer is optimized for large-scale LiDAR data.
 */
export const PotreeViewer: React.FC<PotreeViewerProps> = ({ layer, onClose }) => {
    const potreeContainerRef = useRef<HTMLDivElement>(null);
    const [viewerState, setViewerState] = useState<'loading' | 'ready' | 'error' | 'processing'>('loading');

    // Determine the correct URL to use
    const pointCloudUrl = layer.potree_url || layer.tiles_url || layer.url;
    const isProcessing = layer.status === AssetStatus.PROCESSING;
    const hasError = layer.status === AssetStatus.ERROR;

    useEffect(() => {
        if (!potreeContainerRef.current) return;

        if (isProcessing) {
            setViewerState('processing');
            return;
        }

        if (hasError) {
            setViewerState('error');
            return;
        }

        if (!pointCloudUrl) {
            setViewerState('error');
            return;
        }

        console.log('[PotreeViewer] Initializing with URL:', pointCloudUrl);
        setViewerState('loading');

        // TODO: Full Potree integration
        // 1. Load Potree library dynamically
        // 2. Initialize THREE.js scene
        // 3. Load point cloud from pointCloudUrl
        // For now, we show a placeholder

        return () => {
            console.log('[PotreeViewer] Cleaning up');
        };
    }, [pointCloudUrl, isProcessing, hasError]);

    const renderViewportContent = () => {
        if (viewerState === 'processing') {
            return (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="text-center space-y-4 max-w-md">
                        <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto" />
                        <div className="space-y-2">
                            <p className="text-white/90 font-semibold">Nokta Bulutu İşleniyor</p>
                            <p className="text-white/50 text-sm">
                                LAS/LAZ dosyanız sunucuda Potree ve 3D Tiles formatına dönüştürülüyor.
                                Bu işlem dosya boyutuna göre 10-45 dakika sürebilir.
                            </p>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 mx-auto bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 text-sm transition-all">
                            <RefreshCw size={14} />
                            <span>Durumu Yenile</span>
                        </button>
                    </div>
                </div>
            );
        }

        if (viewerState === 'error') {
            return (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="text-center space-y-4 max-w-md">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                        <div className="space-y-2">
                            <p className="text-white/90 font-semibold">İşlem Başarısız</p>
                            <p className="text-white/50 text-sm">
                                {layer.error_message || 'Nokta bulutu işlenirken bir hata oluştu.'}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        // Loading or ready state
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto" />
                    <div className="space-y-1">
                        <p className="text-white/80 font-medium">Nokta Bulutu Yükleniyor...</p>
                        <p className="text-white/40 text-xs font-mono">{layer.name}</p>
                        {pointCloudUrl && (
                            <p className="text-white/20 text-xs font-mono truncate max-w-xs">
                                {pointCloudUrl.split('/').slice(-2).join('/')}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="absolute inset-0 z-50 bg-[#0a0a0a] flex flex-col animate-in fade-in duration-300">
            {/* Control Bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-[#1a1a1a] border-b border-white/10 shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">
                        <Box size={14} className="text-purple-400" />
                        <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Potree Analyzer</span>
                    </div>
                    <h2 className="text-sm font-medium text-white/90">{layer.name}</h2>
                    {isProcessing && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-500 text-xs">
                            <Loader2 size={10} className="animate-spin" />
                            Processing
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Tool Group */}
                    <div className="flex items-center gap-1 p-1 bg-black/30 rounded-lg border border-white/5 mr-4">
                        <button className="p-2 hover:bg-white/10 rounded-md text-white/60 disabled:opacity-30" title="Measure" disabled={viewerState !== 'ready'}><Move size={16} /></button>
                        <button className="p-2 hover:bg-white/10 rounded-md text-white/60 disabled:opacity-30" title="Clip" disabled={viewerState !== 'ready'}><Box size={16} /></button>
                        <button className="p-2 hover:bg-white/10 rounded-md text-white/60 disabled:opacity-30" title="Layers" disabled={viewerState !== 'ready'}><Layers size={16} /></button>
                        <button className="p-2 hover:bg-white/10 rounded-md text-white/60 disabled:opacity-30" title="Settings" disabled={viewerState !== 'ready'}><Settings size={16} /></button>
                    </div>

                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-md text-red-400 text-xs font-medium transition-all"
                    >
                        <span>Cesium'a Dön</span>
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Main Viewport */}
            <div
                ref={potreeContainerRef}
                className="flex-1 relative cursor-crosshair"
            >
                {renderViewportContent()}
            </div>

            {/* Property Bar */}
            <div className="px-6 py-2 bg-[#141414] border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-white/30 uppercase">Points</span>
                        <span className="text-xs text-white/70 font-mono">{layer.metadata?.pointCount?.toLocaleString() || '---'}</span>
                    </div>
                    <div className="flex flex-col border-l border-white/10 pl-6">
                        <span className="text-[10px] text-white/30 uppercase">Status</span>
                        <span className="text-xs text-white/70 font-mono">{layer.status || 'READY'}</span>
                    </div>
                    <div className="flex flex-col border-l border-white/10 pl-6">
                        <span className="text-[10px] text-white/30 uppercase">Format</span>
                        <span className="text-xs text-white/70 font-mono">{layer.potree_url ? 'Potree' : layer.tiles_url ? '3D Tiles' : 'Raw'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="p-1.5 text-white/20 hover:text-white/60 transition-colors"><Maximize2 size={14} /></button>
                </div>
            </div>
        </div>
    );
};
