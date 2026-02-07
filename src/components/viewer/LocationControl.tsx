import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LocateFixed, X, Loader2, AlertCircle } from 'lucide-react';

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
    const [longPressProgress, setLongPressProgress] = useState(0);

    // Refs for logic
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isLongPressRef = useRef(false); // Valid during the press
    const ignoreClickRef = useRef(false); // Persists until click is handled
    const startTimeRef = useRef(0);

    const LONG_PRESS_DURATION = 1000; // 1 second

    // Show error when it occurs
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (error) {
            setShowError(true);
            timer = setTimeout(() => setShowError(false), 5000);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [error]);

    // Haptic feedback
    const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'medium') => {
        if (typeof navigator.vibrate === 'function') {
            const patterns = { light: [10], medium: [30], heavy: [80] };
            navigator.vibrate(patterns[type]);
        }
    }, []);

    // ------------------------------------------------------------------------
    // INTERACTION HANDLERS
    // ------------------------------------------------------------------------

    const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
        // Only start long press logic if we are already tracking
        if (!isTracking) return;

        // Prevent context menu on long press
        // e.preventDefault(); // CAREFUL: This might block click. Let's not call it unless necessary.

        isLongPressRef.current = false;
        ignoreClickRef.current = false;
        startTimeRef.current = Date.now();
        setLongPressProgress(0);

        // Start Progress Animation
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const progress = Math.min((elapsed / LONG_PRESS_DURATION) * 100, 100);
            setLongPressProgress(progress);
        }, 30);

        // Start Long Press Timer
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            // Long Press Triggered!
            isLongPressRef.current = true;
            ignoreClickRef.current = true; // Tell onClick to ignore this

            triggerHapticFeedback('heavy');
            onStopTracking(); // ACTION: STOP TRACKING

            // Cleanup
            if (intervalRef.current) clearInterval(intervalRef.current);
            setLongPressProgress(0);
        }, LONG_PRESS_DURATION);
    };

    const handlePressEnd = () => {
        // Clear all timers
        if (timerRef.current) clearTimeout(timerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setLongPressProgress(0); // Reset visual
    };

    const handleClick = (e: React.MouseEvent) => {
        // If this click comes after a successful long press, ignore it
        if (ignoreClickRef.current) {
            ignoreClickRef.current = false;
            return;
        }

        // Standard Click Logic
        if (!isTracking) {
            // ACTION: START TRACKING
            triggerHapticFeedback('light');
            onStartTracking();
        } else {
            // ACTION: FLY TO LOCATION
            // (Only if tracking is active and we didn't just stop it via long press)
            if (onFlyToLocation) {
                triggerHapticFeedback('light');
                onFlyToLocation();
            }
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const buttonState = isLoading ? 'loading' : isTracking ? 'active' : 'inactive';

    return (
        <>
            {/* Error Toast */}
            {showError && error && (
                <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-50 max-w-sm w-full mx-4 animate-in slide-in-from-bottom-4 duration-300 pointer-events-none">
                    <div className="bg-red-900/90 backdrop-blur-xl border border-red-500/50 rounded-2xl p-4 shadow-2xl flex items-start gap-3 pointer-events-auto">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-white font-medium">Konum Hatası</p>
                            <p className="text-xs text-red-200 mt-1">{error.message}</p>
                            {error.type === 'PERMISSION_DENIED' && (
                                <p className="text-xs text-red-300 mt-2">Tarayıcı ayarlarından konum iznini etkinleştirin.</p>
                            )}
                        </div>
                        <button onClick={() => setShowError(false)} className="p-1 rounded-full hover:bg-white/10 text-red-300 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Location Button */}
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
                    className={`relative w-10 h-10 md:w-12 md:h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 active:scale-90 backdrop-blur-md border overflow-hidden select-none touch-manipulation group
                        ${buttonState === 'active'
                            ? 'bg-teal-500/90 border-teal-400 text-white shadow-teal-500/30'
                            : 'bg-black/40 border-white/10 text-white/70 hover:bg-black/60 hover:text-white hover:border-white/30'
                        }
                        ${isLoading ? 'opacity-70 cursor-wait' : 'hover:scale-105'}
                    `}
                    title={buttonState === 'active' ? 'Tıkla: Odakla | Basılı tut: Kapat' : 'Konumunu Bul'}
                >
                    {/* Ring for Active State */}
                    {buttonState === 'active' && !isLoading && (
                        <span className="absolute inset-0 rounded-full animate-ping bg-teal-400/30 duration-1000" />
                    )}

                    {/* Long Press Progress Ring - DELAYED VISIBILITY (20%) */}
                    {longPressProgress > 20 && (
                        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 48 48">
                            <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                            <circle
                                cx="24"
                                cy="24"
                                r="22"
                                fill="none"
                                stroke="#EF4444"
                                strokeWidth="4"
                                strokeDasharray={`${(longPressProgress / 100) * 138.23} 138.23`}
                                strokeLinecap="round"
                                className="transition-all duration-75 ease-linear"
                            />
                        </svg>
                    )}

                    {/* Icon */}
                    <div className="relative z-10 transition-transform duration-300 group-hover:scale-110">
                        {isLoading ? (
                            <Loader2 size={24} className="animate-spin text-white/50" />
                        ) : (
                            <LocateFixed
                                size={22}
                                strokeWidth={buttonState === 'active' ? 2.5 : 2}
                                className={`transition-all ${buttonState === 'active' ? 'fill-teal-100/50 text-white' : ''}`}
                            />
                        )}
                    </div>
                </button>

                {/* Hint Tooltip - DELAYED VISIBILITY (250ms / 25%) */}
                {isTracking && longPressProgress > 25 && (
                    <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-black/80 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-lg animate-in fade-in zoom-in duration-200 pointer-events-none border border-white/10 shadow-xl">
                        KAPATMAK İÇİN BEKLE
                    </div>
                )}
            </div>
        </>
    );
};

export default LocationControl;
