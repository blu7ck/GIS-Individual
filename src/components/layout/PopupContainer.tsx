import React from 'react';
import { MeasurementTool } from '../../../components/MeasurementTool';
import { LayerHeightTool } from '../../../components/LayerHeightTool';
import { UploadTool } from '../../../components/UploadTool';
import { PopupType } from '../../hooks/useUIState';
import { MeasurementMode, LayerType, AssetLayer } from '../../../types';

interface PopupContainerProps {
    activePopup: PopupType;
    setActivePopup: (type: PopupType) => void;
    // Measurement Props
    measurementMode: MeasurementMode;
    setMeasurementMode: (mode: MeasurementMode) => void;
    activeTilesetId: string | null;
    // Layer Height Props (Using activeTilesetId as proxy for selected layer for now, usually needs specific layer)
    // In the original App.tsx, LayerHeightTool didn't seem to take specific props other than open state?
    // Checking original usages:
    // <LayerHeightTool isOpen={activePopup === 'layers'} onClose={() => setActivePopup('none')} ... />
    // We need to pass the layer update handler
    onUpdateAsset: (id: string, name: string, updates?: { heightOffset?: number; scale?: number }) => void;
    // Layer Height Props
    assets: AssetLayer[];

    // Upload Props
    selectedProjectId: string | null;
    onUpload: (file: File, type: LayerType) => Promise<void>;
    onFolderUpload: (files: FileList, type: LayerType) => Promise<void>;
    onUrlAdd: (url: string, type: LayerType, name: string) => Promise<void>;
    isUploading: boolean;
    uploadProgress: string;
    uploadProgressPercent: number;
}

export const PopupContainer: React.FC<PopupContainerProps> = ({
    activePopup,
    setActivePopup,
    measurementMode,
    setMeasurementMode,
    onUpdateAsset,
    assets,
    selectedProjectId,
    onUpload,
    onFolderUpload,
    onUrlAdd,
    isUploading,
    uploadProgress,
    uploadProgressPercent
}) => {

    const closePopup = () => setActivePopup('none');

    return (
        <>
            <MeasurementTool
                isOpen={activePopup === 'measurements'}
                onToggle={closePopup}
                activeMode={measurementMode}
                onSetMode={setMeasurementMode}
            />

            <LayerHeightTool
                isOpen={activePopup === 'layers'}
                onToggle={closePopup}
                assets={assets}
                onUpdateAsset={onUpdateAsset}
            />

            <UploadTool
                isOpen={activePopup === 'upload'}
                onToggle={closePopup}
                selectedProjectId={selectedProjectId}
                onUpload={onUpload}
                onFolderUpload={onFolderUpload}
                onUrlAdd={(url, type) => onUrlAdd(url, type, url.split('/').pop() || 'New Layer')}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                uploadProgressPercent={uploadProgressPercent}
            />
        </>
    );
};
