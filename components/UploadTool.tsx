import React from 'react';
import { Upload } from 'lucide-react';
import { ToolbarItem } from './ToolbarItem';
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
    selectedProjectId,
    onUpload,
    onFolderUpload,
    onUrlAdd,
    isUploading,
    uploadProgress,
    uploadProgressPercent,
    ...rest
}) => {
    return (
        <ToolbarItem
            icon={<Upload size={20} />}
            label="Upload Files"
            isOpen={isOpen}
            onToggle={onToggle}
        >
            {!selectedProjectId && (
                <div className="mb-3 p-2 bg-[#1C1B19] border border-[#57544F] rounded-lg text-center">
                    <p className="text-xs text-yellow-500/90 font-medium">Project required</p>
                    <p className="text-[10px] text-gray-400">Select/create a project to upload.</p>
                </div>
            )}

            {selectedProjectId && (
                <FileUpload
                    onUpload={onUpload}
                    onFolderUpload={onFolderUpload}
                    onUrlAdd={onUrlAdd}
                    isUploading={isUploading}
                    uploadProgress={uploadProgress}
                    uploadProgressPercent={uploadProgressPercent}
                    // Custom styles injected via className if FileUpload supports it, otherwise generic wrapper style
                    className={`border-dashed border-2 border-[#57544F] transition-colors rounded-lg p-4 text-center cursor-pointer ${!selectedProjectId
                        ? 'opacity-30 pointer-events-none cursor-not-allowed border-[#57544F]/50'
                        : 'hover:border-[#12B285] hover:bg-[#12B285]/5'
                        }`}
                    {...rest}
                />
            )}
        </ToolbarItem>
    );
};
