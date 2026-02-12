import React, { useState, useEffect } from 'react';
import { X, Save, Info } from 'lucide-react';

interface SaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
    defaultName: string;
    measurementText: string;
    description?: string;
    isLoading?: boolean;
}

export const SaveModal: React.FC<SaveModalProps> = ({
    isOpen,
    onClose,
    onSave,
    defaultName,
    measurementText,
    description,
    isLoading = false
}) => {
    const [name, setName] = useState(defaultName);

    useEffect(() => {
        if (isOpen) {
            setName(defaultName);
        }
    }, [isOpen, defaultName]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (name.trim() && !isLoading) {
            onSave(name.trim());
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-engineering-panel/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-gradient-to-r from-azure/10 to-transparent">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-azure/20 rounded-lg">
                            <Save className="w-5 h-5 text-azure" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Ölçümü Kaydet</h3>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="flex items-start gap-4 p-3 bg-white/5 border border-white/5 rounded-xl">
                        <div className="p-2 bg-scarab/20 rounded-lg mt-1">
                            <Info className="w-4 h-4 text-scarab" />
                        </div>
                        <div>
                            <p className="text-sm text-white/60 mb-1">Ölçüm Sonucu</p>
                            <p className="text-lg font-medium text-white">{measurementText}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/70 ml-1">Ölçüm İsmi</label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            placeholder="Örn: Kuzey Cephe Mesafesi"
                            disabled={isLoading}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-azure/50 transition-all disabled:opacity-50"
                        />
                    </div>

                    {description && (
                        <p className="text-xs text-white/40 italic px-1">
                            {description}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white/5 border-t border-white/5 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all disabled:opacity-50"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim() || isLoading}
                        className="flex-1 px-4 py-2.5 bg-azure text-white font-bold rounded-xl shadow-lg shadow-azure/20 hover:bg-azure/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Kaydediliyor...</span>
                            </>
                        ) : (
                            'Kaydet'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
