import React, { useState, useCallback } from 'react';
import { Lock, Loader2, Map } from 'lucide-react';
import { SecureOverlay } from '../../../components/layout/SecureOverlay';

interface Props {
    /** Loading state from parent */
    isLoading: boolean;
    /** Error message from parent (e.g., API errors) */
    error: string;
    /** Callback to verify PIN with backend - returns true if valid */
    onVerifyPin: (pin: string) => Promise<boolean>;
}

/**
 * SecureLoginForm - Full-page secure viewer login
 * Uses SecureOverlay for PIN input with lockout and visual feedback
 */
export const SecureLoginForm: React.FC<Props> = ({
    isLoading,
    error,
    onVerifyPin
}) => {
    const [showPinOverlay, setShowPinOverlay] = useState(false);

    const handleVerify = useCallback(async (pin: string): Promise<boolean> => {
        return await onVerifyPin(pin);
    }, [onVerifyPin]);

    return (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                        <Map className="text-white" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Secure Viewer</h1>
                    <p className="text-slate-400 text-center">
                        This is a restricted access shared project. Please enter your security PIN to continue.
                    </p>
                </div>

                {/* Error from parent (API errors) */}
                {error && !showPinOverlay && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start">
                        <Lock className="text-red-400 shrink-0 mr-3 mt-0.5" size={18} />
                        <p className="text-sm text-red-200">{error}</p>
                    </div>
                )}

                {/* Unlock Button */}
                <button
                    onClick={() => setShowPinOverlay(true)}
                    disabled={isLoading}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin" size={18} />
                            Verifying Access...
                        </>
                    ) : (
                        <>
                            <Lock size={18} />
                            Enter PIN to Unlock
                        </>
                    )}
                </button>

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-slate-700/50 text-center">
                    <p className="text-xs text-slate-500 font-medium">
                        Protected content • End-to-end encrypted
                    </p>
                </div>
            </div>

            {/* PIN Overlay */}
            <SecureOverlay
                isOpen={showPinOverlay}
                onVerify={handleVerify}
                onCancel={() => setShowPinOverlay(false)}
                pinLength={6}
                maxAttempts={5}
                lockoutDuration={30}
                title="Enter Access PIN"
                description="Enter the PIN provided by the project owner"
                isLoading={isLoading}
                externalError={error}
            />
        </div>
    );
};

export default SecureLoginForm;
