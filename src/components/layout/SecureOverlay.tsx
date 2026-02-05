import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Check, Loader2 } from 'lucide-react';

interface SecureOverlayProps {
    /** Whether the overlay is visible */
    isOpen: boolean;
    /** Callback when PIN is successfully verified - receives the PIN for backend verification */
    onVerify: (pin: string) => Promise<boolean> | boolean;
    /** Callback when user cancels */
    onCancel?: () => void;
    /** PIN length (default: 6) */
    pinLength?: number;
    /** Maximum number of attempts before lockout */
    maxAttempts?: number;
    /** Lockout duration in seconds */
    lockoutDuration?: number;
    /** Title displayed on the overlay */
    title?: string;
    /** Description text */
    description?: string;
    /** External loading state */
    isLoading?: boolean;
    /** External error message */
    externalError?: string;
}

export const SecureOverlay: React.FC<SecureOverlayProps> = ({
    isOpen,
    onVerify,
    onCancel,
    pinLength = 6,
    maxAttempts = 5,
    lockoutDuration = 30,
    title = 'Secure Access Required',
    description = 'Enter your PIN to access this content',
    isLoading: externalLoading = false,
    externalError
}) => {
    const [pin, setPin] = useState<string[]>(Array(pinLength).fill(''));
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attempts, setAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [lockoutRemaining, setLockoutRemaining] = useState(0);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Update external error
    useEffect(() => {
        if (externalError) {
            setError(externalError);
            setPin(Array(pinLength).fill(''));
            inputRefs.current[0]?.focus();
        }
    }, [externalError, pinLength]);

    // Adjust PIN array length
    useEffect(() => {
        if (pin.length !== pinLength) {
            setPin(Array(pinLength).fill(''));
        }
    }, [pinLength]);

    // Focus first input when overlay opens
    useEffect(() => {
        if (isOpen && inputRefs.current[0]) {
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
    }, [isOpen]);

    // Handle lockout countdown
    useEffect(() => {
        if (!isLocked) return;

        const interval = setInterval(() => {
            setLockoutRemaining(prev => {
                if (prev <= 1) {
                    setIsLocked(false);
                    setAttempts(0);
                    setError(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isLocked]);

    const verifyPin = useCallback(async (pinValue: string) => {
        setIsVerifying(true);
        setError(null);

        try {
            const result = await onVerify(pinValue);

            if (result) {
                setIsSuccess(true);
                setTimeout(() => resetState(), 500);
            } else {
                // Wrong PIN
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);

                if (newAttempts >= maxAttempts) {
                    setIsLocked(true);
                    setLockoutRemaining(lockoutDuration);
                    setError(`Too many attempts. Locked for ${lockoutDuration} seconds.`);
                } else {
                    setError(`Incorrect PIN. ${maxAttempts - newAttempts} attempts remaining.`);
                }

                setPin(Array(pinLength).fill(''));
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            }
        } catch (e: any) {
            setError(e.message || 'Verification failed');
            setPin(Array(pinLength).fill(''));
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        } finally {
            setIsVerifying(false);
        }
    }, [onVerify, attempts, maxAttempts, lockoutDuration, pinLength]);

    const handleInputChange = useCallback((index: number, value: string) => {
        if (isLocked || isSuccess || isVerifying || externalLoading) return;

        // Only allow digits
        const digit = value.replace(/\D/g, '').slice(-1);

        const newPin = [...pin];
        newPin[index] = digit;
        setPin(newPin);
        setError(null);

        // Auto-focus next input
        if (digit && index < pinLength - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Check if PIN is complete
        if (newPin.every(d => d !== '')) {
            verifyPin(newPin.join(''));
        }
    }, [pin, pinLength, isLocked, isSuccess, isVerifying, externalLoading, verifyPin]);

    const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !pin[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'Escape' && onCancel) {
            onCancel();
            resetState();
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < pinLength - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    }, [pin, pinLength, onCancel]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, pinLength);

        if (pastedData.length > 0) {
            const newPin = Array(pinLength).fill('');
            pastedData.split('').forEach((digit, i) => {
                if (i < pinLength) newPin[i] = digit;
            });
            setPin(newPin);

            // If complete, verify
            if (pastedData.length === pinLength) {
                verifyPin(pastedData);
            } else {
                // Focus next empty
                inputRefs.current[pastedData.length]?.focus();
            }
        }
    }, [pinLength, verifyPin]);

    const resetState = () => {
        setPin(Array(pinLength).fill(''));
        setError(null);
        setIsSuccess(false);
    };

    if (!isOpen) return null;

    const isInputDisabled = isLocked || isSuccess || isVerifying || externalLoading;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-md mx-4 p-8 bg-engineering-panel border border-engineering-border rounded-2xl shadow-2xl">
                {/* Close Button */}
                {onCancel && (
                    <button
                        onClick={() => { onCancel(); resetState(); }}
                        className="absolute top-4 right-4 text-engineering-text-muted hover:text-engineering-text-primary transition-colors"
                        aria-label="Close"
                    >
                        ×
                    </button>
                )}

                {/* Icon */}
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 transition-all duration-300 ${isSuccess
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isLocked
                            ? 'bg-red-500/20 text-red-400'
                            : isVerifying || externalLoading
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-engineering-primary/20 text-engineering-primary'
                    }`}>
                    {isSuccess ? (
                        <Check size={32} />
                    ) : isVerifying || externalLoading ? (
                        <Loader2 size={32} className="animate-spin" />
                    ) : (
                        <Lock size={32} />
                    )}
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold text-engineering-text-primary text-center mb-2">
                    {title}
                </h2>

                {/* Description */}
                <p className="text-sm text-engineering-text-secondary text-center mb-8">
                    {description}
                </p>

                {/* PIN Input Grid */}
                <div className="flex justify-center gap-3 mb-6">
                    {pin.map((digit, index) => (
                        <input
                            key={index}
                            ref={el => { inputRefs.current[index] = el; }}
                            type={showPin ? 'text' : 'password'}
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleInputChange(index, e.target.value)}
                            onKeyDown={e => handleKeyDown(index, e)}
                            onPaste={handlePaste}
                            disabled={isInputDisabled}
                            className={`w-12 h-14 text-center text-2xl font-mono rounded-lg border-2 transition-all duration-200 outline-none
                                ${isSuccess
                                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                                    : isLocked
                                        ? 'border-red-500/50 bg-red-500/10 text-red-400 cursor-not-allowed'
                                        : error
                                            ? 'border-red-500 bg-engineering-bg text-engineering-text-primary'
                                            : 'border-engineering-border bg-engineering-bg text-engineering-text-primary focus:border-engineering-primary focus:ring-2 focus:ring-engineering-primary/20'
                                }
                                ${isInputDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            aria-label={`PIN digit ${index + 1}`}
                        />
                    ))}
                </div>

                {/* Show/Hide Toggle */}
                <button
                    onClick={() => setShowPin(!showPin)}
                    className="mx-auto flex items-center gap-2 text-sm text-engineering-text-muted hover:text-engineering-text-secondary transition-colors"
                    disabled={isInputDisabled}
                >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showPin ? 'Hide PIN' : 'Show PIN'}
                </button>

                {/* Error Message */}
                {error && (
                    <div className="mt-6 flex items-center gap-2 text-sm text-red-400 justify-center">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Lockout Timer */}
                {isLocked && (
                    <div className="mt-4 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-lg">
                            <span className="text-red-400 font-mono text-lg">
                                {Math.floor(lockoutRemaining / 60).toString().padStart(2, '0')}:
                                {(lockoutRemaining % 60).toString().padStart(2, '0')}
                            </span>
                        </div>
                    </div>
                )}

                {/* Keyboard Hint */}
                <p className="mt-8 text-xs text-engineering-text-muted text-center">
                    Press <kbd className="px-1.5 py-0.5 bg-engineering-border rounded text-engineering-text-secondary">Esc</kbd> to cancel
                </p>
            </div>
        </div>
    );
};

export default SecureOverlay;
