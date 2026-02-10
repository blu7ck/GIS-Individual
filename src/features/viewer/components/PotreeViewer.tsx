import React, { useRef, useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Box, Layers, Check } from 'lucide-react';
import { AssetLayer, AssetStatus } from '../../../types';
import { loadPotreeDependencies } from '../utils/scriptLoader';
import { PotreeCameraControls } from './PotreeCameraControls';
import { PotreeToolbar } from './PotreeToolbar';

interface PotreeViewerProps {
    layers: AssetLayer[];
    initialLayerId?: string;
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
export const PotreeViewer: React.FC<PotreeViewerProps> = ({ layers, initialLayerId, onClose }) => {
    const potreeContainerRef = useRef<HTMLDivElement>(null);
    const [viewerState, setViewerState] = useState<'loading' | 'ready' | 'error' | 'processing'>('loading');
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [potreeViewer, setPotreeViewer] = useState<any>(null);
    const viewerRef = useRef<any>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Active Layer State
    const [activeLayer, setActiveLayer] = useState<AssetLayer | null>(() => {
        if (layers.length === 0) return null;
        if (initialLayerId) {
            const found = layers.find(l => l.id === initialLayerId);
            if (found) return found;
        }
        return layers[0] || null;
    });

    // Update active layer if layers prop changes significantly
    useEffect(() => {
        if (!activeLayer && layers.length > 0) {
            setActiveLayer(layers[0] || null);
        }
    }, [layers]);

    // Determine the correct URL to use
    // Potree needs the 'cloud.js' or 'metadata.json' URL
    let pointCloudUrl = activeLayer ? (activeLayer.potree_url || activeLayer.tiles_url || activeLayer.url) : null;

    // Fix: If it's a directory URL (doesn't end in .json or .js), append metadata.json
    if (pointCloudUrl && !pointCloudUrl.endsWith('.json') && !pointCloudUrl.endsWith('.js')) {
        if (!pointCloudUrl.endsWith('/')) pointCloudUrl += '/';
        pointCloudUrl += 'metadata.json';
    }

    const isProcessing = activeLayer?.status === AssetStatus.PROCESSING;
    const hasError = activeLayer?.status === AssetStatus.ERROR;

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

        // Only try to load if we have a valid layer and URL
        if (activeLayer && !isProcessing && !hasError && pointCloudUrl) {
            loadScripts();
        } else if (isProcessing) {
            setViewerState('processing');
        } else if (hasError || !activeLayer) {
            setViewerState('error');
        }

        return () => { mounted = false; };
    }, [isProcessing, hasError, pointCloudUrl, activeLayer]);

    // 2. Initialize Potree & Load Point Cloud
    useEffect(() => {
        if (!scriptsLoaded || !potreeContainerRef.current || !pointCloudUrl || !activeLayer) return;

        // Reset viewer if layer changes
        if (viewerRef.current) {
            // If we already have a viewer, we might need to just replace the scene or camera,
            // but Potree is tricky. For now, we'll try to just load the new point cloud into the existing viewer
            // clearing the old one.
            // BUT simpler approach: The viewer instance persists, we just clear scene.
            const viewer = viewerRef.current;
            viewer.scene.pointclouds.forEach((pc: any) => viewer.scene.scenePointCloud.remove(pc));
            viewer.scene.pointclouds = [];

            // Now load new one
            loadCloud(viewer, pointCloudUrl, activeLayer.name);
            return;
        }

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

            loadCloud(viewer, pointCloudUrl, activeLayer.name);

        } catch (err) {
            console.error('[PotreeViewer] Error initializing viewer:', err);
            setViewerState('error');
        }

        return () => {
            // Cleanup on unmount handled by ref mainly
        };

    }, [scriptsLoaded, pointCloudUrl, activeLayer?.id]); // Re-run when layer ID changes


    const loadCloud = (viewer: any, url: string, name: string) => {
        try {
            setViewerState('loading');
            window.Potree.loadPointCloud(url, name, (e: any) => {
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
    };


    // --- Render Helpers ---

    const renderViewportContent = () => {
        if (!activeLayer) return null;

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
                            <p className="text-white/40 text-xs font-mono">{activeLayer.name}</p>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="absolute inset-0 z-50 bg-[#0a0a0a] flex animate-in fade-in duration-300">

            {/* Sidebar for Multiple Layers */}
            {layers.length > 1 && (
                <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-black/80 backdrop-blur-xl border-r border-white/10 transition-all duration-300 flex flex-col overflow-hidden z-[100]`}>
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white/70">
                            <Layers size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Bulutlar</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {layers.map(layer => (
                            <button
                                key={layer.id}
                                onClick={() => setActiveLayer(layer)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${activeLayer?.id === layer.id
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <span className="truncate flex-1">{layer.name}</span>
                                {activeLayer?.id === layer.id && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 relative flex flex-col h-full">

                {/* Toggle Sidebar Button (Only if multiple layers) */}
                {layers.length > 1 && (
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="absolute top-4 left-4 z-[90] p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg text-white/70 hover:text-white transition-all"
                    >
                        <Layers size={20} />
                    </button>
                )}

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

                    {/* 2. Header Overlay - Top Left - Adjusted for sidebar toggle */}
                    {/* Kept for context metadata */}
                    <div className={`absolute top-4 ${layers.length > 1 ? 'left-16' : 'left-4'} z-[90] transition-all duration-300 pointer-events-none`}>
                        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-lg flex items-center gap-3">
                            <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-300">
                                <Box size={14} />
                                <span className="text-xs font-bold uppercase tracking-wider">FIXURELABS v1.8</span>
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-white leading-none">{activeLayer?.name}</h2>
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
        </div>
    );
};
