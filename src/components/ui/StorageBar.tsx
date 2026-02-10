import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HardDrive, Trash2, AlertTriangle, X, RotateCcw } from 'lucide-react';
import { StorageConfig } from '../../types';
import { wipeAllR2Storage, DeleteProgress } from '../../services/storage';
import { createSupabaseClient } from '../../lib/supabase';

interface Props {
    storageConfig: StorageConfig | null;
    maxStorageGB?: number;
    onRefreshNeeded?: () => void;
    storageRefreshKey?: number;
}

interface StorageStats {
    totalBytes: number;
    totalGB: number;
    fileCount: number;
}

export const StorageBar: React.FC<Props> = ({ storageConfig, maxStorageGB = 10, onRefreshNeeded, storageRefreshKey = 0 }) => {
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showWipeModal, setShowWipeModal] = useState(false);
    const [isWiping, setIsWiping] = useState(false);
    const [wipeProgress, setWipeProgress] = useState<DeleteProgress | null>(null);
    const cancelRef = useRef(false);

    // ... (logic remains same)

    const fetchStats = async () => {
        if (!storageConfig?.workerUrl) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${storageConfig.workerUrl}/storage-stats`);
            if (!response.ok) {
                throw new Error('Failed to fetch storage stats');
            }
            const data = await response.json();
            setStats({
                totalBytes: data.totalBytes || 0,
                totalGB: data.totalGB || 0,
                fileCount: data.fileCount || 0
            });
        } catch (e: any) {
            console.error('Storage stats error:', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [storageConfig?.workerUrl, storageRefreshKey]);

    const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const usedPercent = stats ? Math.min((stats.totalGB / maxStorageGB) * 100, 100) : 0;

    const getBarColor = () => {
        if (usedPercent > 90) return 'bg-[#EF4444]'; // Red-500
        if (usedPercent > 70) return 'bg-[#F59E0B]'; // Amber-500
        return 'bg-[#06B6D4]'; // Cyan-500
    };

    const handleWipeStorage = async () => {
        if (!storageConfig) return;

        cancelRef.current = false;
        setIsWiping(true);
        setWipeProgress(null);

        try {
            // Step 1: Clear Supabase tables (assets first due to FK, then projects)
            if (storageConfig.supabaseUrl && storageConfig.supabaseKey) {
                setWipeProgress({
                    currentAttempt: 0,
                    totalDeleted: 0,
                    totalErrors: 0,
                    status: 'running',
                    message: 'Clearing database records...'
                });

                const supabase = createSupabaseClient(storageConfig.supabaseUrl, storageConfig.supabaseKey);

                // Delete all assets
                const { error: assetsError } = await supabase
                    .from('assets')
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (workaround)

                if (assetsError) {
                    console.error('Failed to delete assets:', assetsError);
                }

                // Delete all projects
                const { error: projectsError } = await supabase
                    .from('projects')
                    .delete()
                    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

                if (projectsError) {
                    console.error('Failed to delete projects:', projectsError);
                }

                setWipeProgress({
                    currentAttempt: 0,
                    totalDeleted: 0,
                    totalErrors: 0,
                    status: 'running',
                    message: 'Database cleared! Now wiping R2 storage...'
                });
            }

            // Step 2: Wipe R2 storage
            await wipeAllR2Storage(
                storageConfig,
                (progress) => setWipeProgress(progress),
                () => cancelRef.current
            );

            // Refresh stats after wipe
            await fetchStats();
            onRefreshNeeded?.();

        } catch (e: any) {
            console.error('Wipe error:', e);
        } finally {
            setIsWiping(false);
            if (wipeProgress?.status === 'completed') {
                setShowWipeModal(false);
            }
        }
    };

    const handleCancelWipe = () => {
        cancelRef.current = true;
    };

    if (!storageConfig?.workerUrl) {
        return null;
    }

    return (
        <>
            <div className="px-4 py-3 border-t border-white/5 bg-black/10 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <HardDrive size={14} className="text-cyan-400" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bulut Depolama</span>
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                            {loading ? (
                                <span className="animate-pulse">Güncelleniyor...</span>
                            ) : error ? (
                                <span className="text-red-400">Bağlantı Hatası</span>
                            ) : stats ? (
                                <span className="text-gray-400">
                                    <strong className="text-gray-200">{formatSize(stats.totalBytes)}</strong> / {maxStorageGB} GB
                                </span>
                            ) : (
                                <span>--</span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* Wipe All Button */}
                        <button
                            onClick={() => setShowWipeModal(true)}
                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-white/5 rounded-lg transition-all"
                            title="Tüm Veriyi Sil"
                        >
                            <Trash2 size={14} />
                        </button>

                        {/* Reset Warnings Button */}
                        <button
                            onClick={() => {
                                if (window.confirm('Uyarı ayarları sıfırlansın mı? Sayfa yeniden yüklenecek.')) {
                                    localStorage.removeItem('cartax_delete_dont_ask');
                                    window.location.reload();
                                }
                            }}
                            className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                            title="Uyarıları Sıfırla"
                        >
                            <RotateCcw size={14} />
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                        className={`h-full ${getBarColor()} transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(6,182,212,0.2)]`}
                        style={{ width: `${usedPercent}%` }}
                    />
                </div>

                {stats && !loading && !error && (
                    <div className="flex justify-between items-center mt-2.5">
                        <span className="text-[9px] text-gray-600 font-bold uppercase tracking-tight">{stats.fileCount} DOSYA</span>
                        <span className="text-[9px] text-gray-600 font-bold uppercase tracking-tight">%{usedPercent.toFixed(1)} DOLU</span>
                    </div>
                )}
            </div>

            {/* Wipe Confirmation Modal */}
            {showWipeModal && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in">
                    <div className="bg-[#1C1B19] border border-red-500/50 rounded-lg p-5 max-w-md w-full shadow-2xl relative">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/20 rounded-full">
                                <AlertTriangle className="text-red-500" size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-red-500">⚠️ DANGER ZONE</h3>
                                <p className="text-xs text-gray-400">This action cannot be undone!</p>
                            </div>
                            {!isWiping && (
                                <button
                                    onClick={() => setShowWipeModal(false)}
                                    className="ml-auto text-gray-400 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>

                        {!isWiping ? (
                            <>
                                <p className="text-sm text-gray-300 mb-4">
                                    This will <strong className="text-red-400">permanently delete EVERYTHING</strong>:
                                    all R2 files AND all database records (projects, assets).
                                </p>
                                <div className="bg-red-900/30 border border-red-500/30 rounded p-3 mb-4">
                                    <p className="text-xs text-red-300">
                                        📁 Files to delete: <strong>{stats?.fileCount || '?'}</strong><br />
                                        💾 Storage to free: <strong>{stats ? formatSize(stats.totalBytes) : '?'}</strong>
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowWipeModal(false)}
                                        className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleWipeStorage}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors font-bold"
                                    >
                                        🗑️ WIPE ALL
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mb-4">
                                    <div className="flex items-center justify-between text-sm mb-2">
                                        <span className="text-gray-400">
                                            {wipeProgress?.status === 'paused' ? '⏸️ Paused (cooling down)' :
                                                wipeProgress?.status === 'completed' ? '✅ Completed!' :
                                                    wipeProgress?.status === 'cancelled' ? '🚫 Cancelled' :
                                                        '🔄 Wiping...'}
                                        </span>
                                        <span className="text-[#12B285] font-mono">
                                            {wipeProgress?.totalDeleted || 0} deleted
                                        </span>
                                    </div>
                                    <div className="h-2 bg-[#57544F]/30 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-500 transition-all duration-300 rounded-full"
                                            style={{
                                                width: wipeProgress?.status === 'completed' ? '100%' :
                                                    wipeProgress?.status === 'cancelled' ? '0%' :
                                                        `${Math.min((wipeProgress?.currentAttempt || 0) * 2, 95)}%`
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-2">
                                        {wipeProgress?.message || 'Starting...'}
                                    </p>
                                    <p className="text-[10px] text-gray-600 mt-1">
                                        Attempt: {wipeProgress?.currentAttempt || 0} | Errors: {wipeProgress?.totalErrors || 0}
                                    </p>
                                </div>

                                {wipeProgress?.status !== 'completed' && wipeProgress?.status !== 'cancelled' ? (
                                    <button
                                        onClick={handleCancelWipe}
                                        className="w-full px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                                    >
                                        Cancel Wipe
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setShowWipeModal(false)}
                                        className="w-full px-4 py-2 bg-[#12B285] text-white rounded hover:bg-[#0e9a72] transition-colors"
                                    >
                                        Close
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};
