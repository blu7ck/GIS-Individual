import { useState } from 'react';
import { LayerType, StorageConfig, AssetLayer } from '../types';
import { uploadFileAsset, uploadFolderAsset, addUrlAsset } from '../services/assetService';
import { NotificationType } from '../components/common/Notification';

export function useFileUpload(
    selectedProjectId: string | null,
    storageConfig: StorageConfig | null,
    setAssets: React.Dispatch<React.SetStateAction<AssetLayer[]>>,
    notify: (msg: string, type: NotificationType) => void,
    setShowSettings: (show: boolean) => void
) {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
    const [uploadProgressPercent, setUploadProgressPercent] = useState(0);

    const handleFileUpload = async (file: File, type: LayerType, options?: { noTransform?: boolean; referencePoint?: { lng: number; lat: number } }) => {
        if (!selectedProjectId) {
            notify("Please select or create a project first", "error");
            return;
        }

        setIsUploading(true);
        setUploadProgressPercent(0);

        const result = await uploadFileAsset(
            file,
            type,
            selectedProjectId,
            storageConfig,
            options,
            (progress) => {
                setUploadProgressPercent(progress.percent);
                setUploadProgress(progress.message);
            }
        );

        if (result.success && result.data) {
            setAssets((prev) => [...prev, result.data!]);
            notify("File uploaded successfully", "success");
        } else {
            notify(result.error || "Upload failed", "error");
        }

        setIsUploading(false);
        setUploadProgressPercent(0);
        setUploadProgress("");
    };

    const handleFolderUpload = async (files: FileList, _type: LayerType) => {
        if (!selectedProjectId) {
            notify("Select a project first", "error");
            return;
        }
        if (!storageConfig) {
            setShowSettings(true);
            return;
        }
        if (!files || files.length === 0) {
            notify("Please select a folder with files", "error");
            return;
        }

        setIsUploading(true);
        setUploadProgress(`0/${files.length}`);

        const result = await uploadFolderAsset(
            files,
            selectedProjectId,
            storageConfig,
            (current, total) => setUploadProgress(`${current}/${total}`)
        );

        if (result.success && result.data) {
            setAssets((prev) => [...prev, result.data!]);
            notify("Folder uploaded", "success");
        } else {
            notify(result.error || "Folder upload failed", "error");
        }

        setIsUploading(false);
        setUploadProgress("");
    };

    const handleUrlAdd = async (url: string, type: LayerType, name: string) => {
        if (!selectedProjectId) {
            notify("Please select or create a project first", "error");
            return;
        }

        setIsUploading(true);
        setUploadProgress("Adding URL asset...");

        const result = await addUrlAsset(url, type, name, selectedProjectId, storageConfig);

        if (result.success && result.data) {
            setAssets((prev) => [...prev, result.data!]);
            notify("URL asset added successfully", "success");
        } else {
            notify(result.error || "Failed to add URL asset", "error");
        }

        setIsUploading(false);
        setUploadProgress("");
    };

    return {
        isUploading,
        uploadProgress,
        uploadProgressPercent,
        handleFileUpload,
        handleFolderUpload,
        handleUrlAdd
    };
}
