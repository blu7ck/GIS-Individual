import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigation, X, Loader2, AlertCircle } from 'lucide-react';

interface LocationControlProps {
    isTracking: boolean;
    isLoading: boolean;
    hasPosition: boolean;
    error: { message: string; type: string } | null;
    onStartTracking: () => void;
    onStopTracking: () => void;
    onFlyToLocation?: () => void;
}

export const LocationControl: React.FC<LocationControlProps> = ({
    isTracking,
    isLoading,
    hasPosition,
    error,
    onStartTracking,
    onStopTracking,
    onFlyToLocation,
}) => {
    const [showError, setShowError] = useState(false);
    const [isLongPressing, setIsLongPressing] = useState(false);
    const [longPressProgress, setLongPressProgress] = useState(0);
    const longPressTimerRef = useRef<number | null>(null);
    const longPressStartRef = useRef<number>(0);
    const progressIntervalRef = useRef<number | null>(null);

    const LONG_PRESS_DURATION = 3000; // 3 seconds

    // Show error when it occurs
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (error) {
            setShowError(true);
            timer = setTimeout(() => setShowError(false), 5000);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [error]);

    // Haptic feedback for mobile
    const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'medium') => {
        try {
            if ('vibrate' in navigator) {
                const patterns = {
                    light: [15],
                    medium: [40],
                    heavy: [100, 50, 100], // Stronger pattern for long press complete
                };
                navigator.vibrate(patterns[type]);
            }
        } catch (e) {
            // Vibrate API may not be available
            console.log('[Haptic] Vibrate not available:', e);
        }
    }, []);

    // Handle button click
    const handleClick = useCallback(() => {
        if (isLongPressing) return; // Don't trigger click after long press

        if (!isTracking) {
            // Not tracking: Start tracking
            triggerHapticFeedback('light');
            onStartTracking();
        } else if (isTracking && hasPosition && onFlyToLocation) {
            // Currently tracking and has position: Fly to location
            triggerHapticFeedback('light');
            onFlyToLocation();
        }
    }, [isTracking, hasPosition, isLongPressing, onStartTracking, onFlyToLocation, triggerHapticFeedback]);

    // Long press start - only works when tracking is active
    const handlePressStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        // Long press only works when actively tracking
        if (!isTracking) return;

        // Don't call preventDefault on passive touch events
        if (e.type === 'mousedown') {
            e.preventDefault();
        }

        setIsLongPressing(false);
        setLongPressProgress(0);
        longPressStartRef.current = Date.now();

        // Progress animation
        progressIntervalRef.current = window.setInterval(() => {
            const elapsed = Date.now() - longPressStartRef.current;
            const progress = Math.min((elapsed / LONG_PRESS_DURATION) * 100, 100);
            setLongPressProgress(progress);
        }, 50);

        // Long press timer
        longPressTimerRef.current = window.setTimeout(() => {
            setIsLongPressing(true);
            setLongPressProgress(0);
            triggerHapticFeedback('heavy');
            onStopTracking();

            // Clear progress interval
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
        }, LONG_PRESS_DURATION);
    }, [isTracking, onStopTracking, triggerHapticFeedback]);

    // Long press end
    const handlePressEnd = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
        setLongPressProgress(0);

        // Reset long pressing state after a short delay
        setTimeout(() => setIsLongPressing(false), 100);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        };
    }, []);

    // Determine button state - green only when actively tracking
    const getButtonState = () => {
        if (isLoading) return 'loading';
        if (isTracking) return 'active';
        return 'inactive';
    };

    const buttonState = getButtonState();

    return (
        <>
            {/* Error Toast */}
            {showError && error && (
                <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 max-w-sm w-full mx-4 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-red-900/90 backdrop-blur-xl border border-red-500/50 rounded-xl p-4 shadow-2xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-white font-medium">Konum Hatası</p>
                            <p className="text-xs text-red-200 mt-1">{error.message}</p>
                            {error.type === 'PERMISSION_DENIED' && (
                                <p className="text-xs text-red-300 mt-2">
                                    Tarayıcı ayarlarından konum iznini etkinleştirin.
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => setShowError(false)}
                            className="p-1 rounded-full hover:bg-white/10 text-red-300"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Single Location Button - positioned by parent */}
            <div className="pointer-events-auto">
                <button
                    onClick={handleClick}
                    onMouseDown={handlePressStart}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={handlePressStart}
                    onTouchEnd={handlePressEnd}
                    onTouchCancel={handlePressEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={isLoading}
                    className={`relative w-10 h-10 md:w-12 md:h-12 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 backdrop-blur-sm border overflow-hidden select-none touch-manipulation
            ${buttonState === 'active'
                            ? 'bg-[#12B285] text-white border-[#12B285]'
                            : 'bg-[#1C1B19]/90 text-[#12B285] border-[#57544F] hover:border-[#12B285] hover:bg-[#1C1B19]'
                        }
            ${isLoading ? 'opacity-70 cursor-wait' : 'hover:scale-110'}
          `}
                    title={
                        buttonState === 'active'
                            ? 'Tıkla: Konuma git | Basılı tut: Durdur'
                            : 'Canlı konum başlat'
                    }
                    aria-label={
                        buttonState === 'active'
                            ? 'Konuma git (3 saniye basılı tutarak durdur)'
                            : 'Canlı konum başlat'
                    }
                    style={{
                        boxShadow: buttonState === 'active'
                            ? '0 4px 20px rgba(18, 178, 133, 0.4)'
                            : '0 4px 20px rgba(0,0,0,0.4)'
                    }}
                >
                    {/* Long press progress ring */}
                    {longPressProgress > 0 && (
                        <svg
                            className="absolute inset-0 w-full h-full -rotate-90"
                            viewBox="0 0 48 48"
                        >
                            <circle
                                cx="24"
                                cy="24"
                                r="22"
                                fill="none"
                                stroke="rgba(239, 68, 68, 0.3)"
                                strokeWidth="3"
                            />
                            <circle
                                cx="24"
                                cy="24"
                                r="22"
                                fill="none"
                                stroke="#EF4444"
                                strokeWidth="3"
                                strokeDasharray={`${(longPressProgress / 100) * 138.23} 138.23`}
                                strokeLinecap="round"
                            />
                        </svg>
                    )}

                    {/* Icon */}
                    <div className="relative z-10">
                        {isLoading ? (
                            <Loader2 size={24} className="animate-spin" />
                        ) : (
                            <Navigation
                                size={24}
                                className={`transition-transform ${buttonState === 'active' ? 'fill-current' : ''}`}
                            />
                        )}
                    </div>

                    {/* Pulsing ring when active */}
                    {buttonState === 'active' && !isLoading && (
                        <span className="absolute inset-0 rounded-full animate-ping bg-[#12B285]/30" />
                    )}
                </button>

                {/* Hint text for long press */}
                {isTracking && longPressProgress > 0 && (
                    <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 whitespace-nowrap bg-black/80 text-white text-xs px-2 py-1 rounded">
                        Durdurmak için basılı tut...
                    </div>
                )}
            </div>
        </>
    );
};

export default LocationControl;
