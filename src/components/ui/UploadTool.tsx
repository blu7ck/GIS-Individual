import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { FileUpload } from './FileUpload';

type FileUploadProps = React.ComponentProps<typeof FileUpload>;

interface Props extends FileUploadProps {
    isOpen: boolean;
    onToggle: () => void;
    selectedProjectId: string | null;
}

export const UploadTool: React.FC<Props> = ({
    isOpen,
    onToggle,
    selectedProjectId: _selectedProjectId,
    onUpload,
    onFolderUpload,
    onUrlAdd,
    isUploading,
    uploadProgress,
    uploadProgressPercent
}) => {
    // Add ESC key listener
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                onToggle();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onToggle]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop with Blur */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-in fade-in duration-500"
                onClick={onToggle}
            />

            {/* Screen-Fixed Close Button (Right Top) */}
            <div className="fixed top-8 right-8 z-[200]">
                <button
                    onClick={onToggle}
                    className="group flex items-center gap-4 px-6 py-3 bg-black/40 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 rounded-2xl transition-all duration-500 backdrop-blur-2xl shadow-[0_16px_32px_-8px_rgba(0,0,0,0.5)] active:scale-95"
                >
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 group-hover:text-red-400 leading-none mb-1">Kapat</span>
                        <span className="text-[8px] font-bold text-white/20 group-hover:text-red-500/40">ESC KISAYOLU</span>
                    </div>
                    <div className="w-[1px] h-8 bg-white/10 group-hover:bg-red-500/20 mx-1" />
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 group-hover:bg-red-500/30 text-white/50 group-hover:text-white transition-all">
                        <X size={24} />
                    </div>
                </button>
            </div>

            {/* Modal Content */}
            <div className="relative w-full max-w-6xl max-h-[85vh] flex flex-col bg-engineering-panel/80 border border-engineering-border shadow-[0_64px_128px_-32px_rgba(0,0,0,0.8)] rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 fade-in duration-700 backdrop-blur-3xl">
                {/* Seamless Upload Area */}
                <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                    <FileUpload
                        onUpload={onUpload}
                        onFolderUpload={onFolderUpload}
                        onUrlAdd={onUrlAdd}
                        isUploading={isUploading}
                        uploadProgress={uploadProgress}
                        uploadProgressPercent={uploadProgressPercent}
                    />
                </div>
            </div>
        </div>
    );
};
