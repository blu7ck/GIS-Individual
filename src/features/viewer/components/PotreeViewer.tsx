import React, { useRef, useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Box } from 'lucide-react';
import { AssetLayer, AssetStatus } from '../../../types';
import { loadPotreeDependencies } from '../utils/scriptLoader';
import { PotreeCameraControls } from './PotreeCameraControls';
import { PotreeToolbar } from './PotreeToolbar';

interface PotreeViewerProps {
    layer: AssetLayer;
    onClose: () => void;
}

declare global {
    interface Window {
        Potree: any;
        THREE: any;
    }
}

/**
 * PotreeViewer - Advanced Point Cloud Analysis Tool
 * Dynamically loads Potree libraries and renders the point cloud.
 */
export const PotreeViewer: React.FC<PotreeViewerProps> = ({ layer, onClose }) => {
    const potreeContainerRef = useRef<HTMLDivElement>(null);
    const [viewerState, setViewerState] = useState<'loading' | 'ready' | 'error' | 'processing'>('loading');
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [potreeViewer, setPotreeViewer] = useState<any>(null);
    const viewerRef = useRef<any>(null);

    // Determine the correct URL to use
    // Potree needs the 'cloud.js' or 'metadata.json' URL
    let pointCloudUrl = layer.potree_url || layer.tiles_url || layer.url;

    // Fix: If it's a directory URL (doesn't end in .json or .js), append metadata.json
    if (pointCloudUrl && !pointCloudUrl.endsWith('.json') && !pointCloudUrl.endsWith('.js')) {
        if (!pointCloudUrl.endsWith('/')) pointCloudUrl += '/';
        pointCloudUrl += 'metadata.json';
    }

    const isProcessing = layer.status === AssetStatus.PROCESSING;
    const hasError = layer.status === AssetStatus.ERROR;

    // 1. Load Scripts
    useEffect(() => {
        let mounted = true;

        const loadScripts = async () => {
            // If already loaded globally, just proceed
            if (window.Potree && window.THREE) {
                setScriptsLoaded(true);
                return;
            }

            try {
                await loadPotreeDependencies();
                if (mounted) setScriptsLoaded(true);
            } catch (err) {
                console.error("Failed to load Potree scripts:", err);
                if (mounted) setViewerState('error');
            }
        };

        if (!isProcessing && !hasError && pointCloudUrl) {
            loadScripts();
        } else if (isProcessing) {
            setViewerState('processing');
        } else if (hasError) {
            setViewerState('error');
        }

        return () => { mounted = false; };
    }, [isProcessing, hasError, pointCloudUrl]);

    // 2. Initialize Potree & Load Point Cloud
    useEffect(() => {
        if (!scriptsLoaded || !potreeContainerRef.current || !pointCloudUrl) return;
        if (viewerRef.current) return; // Already initialized

        console.log('[PotreeViewer] Initializing Viewer...');

        try {
            // Check availability
            if (!window.Potree) {
                console.error("Potree globabl object not found!");
                setViewerState('error');
                return;
            }

            // Initialize Viewer
            const viewer = new window.Potree.Viewer(potreeContainerRef.current);
            viewerRef.current = viewer;
            setPotreeViewer(viewer); // Trigger UI updates

            viewer.setEDLEnabled(true);
            viewer.setFOV(60);
            viewer.setPointBudget(2_000_000); // 2M points
            viewer.loadSettingsFromURL();

            // Hide Standard Potree UI elements we don't want
            viewer.setDescription("");

            // Potree 1.8: Load Point Cloud
            try {
                window.Potree.loadPointCloud(pointCloudUrl, layer.name, (e: any) => {
                    const pointcloud = e.pointcloud;
                    const material = pointcloud.material;

                    material.size = 1;
                    material.pointSizeType = window.Potree.PointSizeType.ADAPTIVE;
                    material.shape = window.Potree.PointShape.SQUARE;

                    viewer.scene.addPointCloud(pointcloud);
                    viewer.fitToScreen();

                    setViewerState('ready');
                    console.log('[PotreeViewer] Point cloud loaded successfully');
                });
            } catch (loadErr) {
                console.error('[PotreeViewer] Load command failed:', loadErr);
                setViewerState('error');
            }

        } catch (err) {
            console.error('[PotreeViewer] Error initializing viewer:', err);
            setViewerState('error');
        }

        return () => {
            // Cleanup if necessary
            console.log('[PotreeViewer] Unmounting...');
            viewerRef.current = null;
            setPotreeViewer(null);
        };

    }, [scriptsLoaded, pointCloudUrl, layer.name]);


    // --- Render Helpers ---

    const renderViewportContent = () => {
        if (viewerState === 'processing') {
            return (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50">
                    <div className="text-center space-y-4 max-w-md">
                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                        <div className="space-y-2">
                            <p className="text-white/90 font-semibold text-lg">Nokta Bulutu İşleniyor</p>
                            <p className="text-white/50 text-sm">
                                Dosyanız görüntüleme için hazırlanıyor. Bu işlem dosya boyutuna göre biraz zaman alabilir.
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        if (viewerState === 'error') {
            return (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50">
                    <div className="text-center space-y-4 max-w-md">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                        <div className="space-y-2">
                            <p className="text-white/90 font-semibold text-lg">Yükleme Başarısız</p>
                            <p className="text-white/50 text-sm">
                                Potree kütüphaneleri veya nokta bulutu dosyası yüklenemedi.
                            </p>
                            <p className="text-xs text-red-400/50 break-all">{pointCloudUrl}</p>
                        </div>
                        <button onClick={onClose} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
                            Kapat
                        </button>
                    </div>
                </div>
            );
        }

        if (viewerState === 'loading') {
            return (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                        <div className="space-y-1">
                            <p className="text-white/90 font-medium">Potree Viewer Yükleniyor...</p>
                            <p className="text-white/40 text-xs font-mono">Modüller hazırlanıyor</p>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="absolute inset-0 z-50 bg-[#0a0a0a] flex flex-col animate-in fade-in duration-300">
            {/* Loading/Error Overlays */}
            {renderViewportContent()}

            {/* Main Viewport */}
            <div
                ref={potreeContainerRef}
                className="flex-1 relative cursor-crosshair overflow-hidden"
                style={{ width: '100%', height: '100%', touchAction: 'none' }}
            >
                {/* 1. Back to Cesium Button - Vertical Center Right */}
                <div className="absolute top-1/2 right-4 transform -translate-y-1/2 z-[100]">
                    <button
                        onClick={onClose}
                        className="group flex flex-col items-center justify-center w-12 h-24 bg-black/60 hover:bg-red-500/90 backdrop-blur-md border border-white/10 rounded-full text-white/80 hover:text-white transition-all shadow-xl"
                        title="Cesium Haritasına Dön"
                    >
                        <X size={28} className="mb-2" />
                        <span className="text-[10px] font-bold uppercase tracking-wider -rotate-90 whitespace-nowrap">Çıkış</span>
                    </button>
                </div>

                {/* 2. Header Overlay - Top Left */}
                {/* Kept for context metadata */}
                <div className="absolute top-4 left-4 z-[90] bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-lg pointer-events-none">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-300">
                            <Box size={14} />
                            <span className="text-xs font-bold uppercase tracking-wider">FIXURELABS v1.8</span>
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white leading-none">{layer.name}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-white/50 font-mono">
                                    {viewerState === 'ready' ? 'Ready' : 'Initializing...'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Custom UI Components */}
                {viewerState === 'ready' && potreeViewer && (
                    <>
                        <PotreeCameraControls viewer={potreeViewer} />
                        <PotreeToolbar viewer={potreeViewer} />
                    </>
                )}

            </div>
        </div>
    );
};
