import React from 'react';
import { X } from 'lucide-react';
import { FileUpload } from './FileUpload';
import { Button } from '../common/Button';

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
    uploadProgress
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop with Blur */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onToggle}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-xl bg-engineering-panel/90 border border-engineering-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300 backdrop-blur-xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-engineering-border bg-white/5">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold text-white tracking-tight">Upload Assets</h2>
                        <p className="text-xs text-gray-400">Add 3D models, KML, or other GIS data to your project</p>
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onToggle}
                        className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full w-10 h-10 p-0"
                    >
                        <X size={20} />
                    </Button>
                </div>

                {/* Upload Area */}
                <div className="p-6">
                    <FileUpload
                        onUpload={onUpload}
                        onFolderUpload={onFolderUpload}
                        onUrlAdd={onUrlAdd}
                        isUploading={isUploading}
                        uploadProgress={uploadProgress}
                    />
                </div>
            </div>
        </div>
    );
};
