import { useState, useRef } from 'react';
import { LayerType, StorageConfig, AssetLayer } from '../types';
import { uploadFileAsset, uploadFolderAsset, addUrlAsset } from '../services/assetService';
import { NotificationType } from '../components/common/Notification';

export function useFileUpload(
    selectedProjectId: string | null,
    storageConfig: StorageConfig | null,
    setAssets: React.Dispatch<React.SetStateAction<AssetLayer[]>>,
    notify: (msg: string, type: NotificationType) => void,
    setShowSettings: (show: boolean) => void,
    setStorageRefreshKey?: React.Dispatch<React.SetStateAction<number>>
) {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
    const [uploadProgressPercent, setUploadProgressPercent] = useState(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    const cancelUpload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsUploading(false);
            setUploadProgress("");
            setUploadProgressPercent(0);
            notify("Upload cancelled", "info");
        }
    };

    const handleFileUpload = async (file: File, type: LayerType, options?: { noTransform?: boolean; referencePoint?: { lng: number; lat: number } }) => {
        if (!selectedProjectId) {
            notify("Please select or create a project first", "error");
            return;
        }

        setIsUploading(true);
        setUploadProgressPercent(0);

        // Create new AbortController
        abortControllerRef.current = new AbortController();

        const result = await uploadFileAsset(
            file,
            type,
            selectedProjectId,
            storageConfig,
            options,
            (progress) => {
                setUploadProgressPercent(progress.percent);
                setUploadProgress(progress.message);
            },
            abortControllerRef.current.signal
        );

        if (result.success && result.data) {
            setAssets((prev) => [...prev, result.data!]);
            setStorageRefreshKey?.(prev => prev + 1);
            notify("File uploaded successfully", "success");
        } else if (result.error !== 'Upload cancelled') {
            notify(result.error || "Upload failed", "error");
        }

        setIsUploading(false);
        setUploadProgressPercent(0);
        setUploadProgress("");
        abortControllerRef.current = null;
    };

    const handleFolderUpload = async (files: FileList, type: LayerType) => {
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

        console.log(`[Upload Started] Folder upload initiated with ${files.length} files. Type: ${type}`);
        setIsUploading(true);
        setUploadProgress(`0/${files.length}`);

        // Create new AbortController
        abortControllerRef.current = new AbortController();

        const result = await uploadFolderAsset(
            files,
            type,
            selectedProjectId,
            storageConfig,
            (currentBytes, totalBytes) => {
                const percent = Math.round((currentBytes / totalBytes) * 100);
                const currentMB = (currentBytes / (1024 * 1024)).toFixed(2);
                const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
                setUploadProgress(`${currentMB} MB / ${totalMB} MB`);
                setUploadProgressPercent(percent);
            },
            abortControllerRef.current.signal
        );

        if (result.success && result.data) {
            setAssets((prev) => [...prev, result.data!]);
            setStorageRefreshKey?.(prev => prev + 1);
            notify("Folder uploaded", "success");
        } else if (result.error !== 'Upload cancelled') {
            notify(result.error || "Folder upload failed", "error");
        }

        setIsUploading(false);
        setUploadProgress("");
        abortControllerRef.current = null;
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
        handleUrlAdd,
        cancelUpload
    };
}
