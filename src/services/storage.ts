import { StorageConfig, LayerType } from "../types";
import { logger } from "../utils/logger";

// Interface for the response from the Worker
interface PresignedResponse {
  uploadUrl: string;
  publicUrl: string;
}

/**
 * Uploads a single file using a Presigned URL flow.
 * Automatically chooses between standard PUT and Multipart Upload for large files.
 */
export const uploadToR2 = async (file: File, config: StorageConfig, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<string> => {
  if (!config.workerUrl) {
    throw new Error("Missing Backend Worker URL");
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `uploads/${Date.now()}-${sanitizedName}`;

  // Use multipart for files > 20MB
  const MULTIPART_THRESHOLD = 20 * 1024 * 1024;
  if (file.size > MULTIPART_THRESHOLD) {
    logger.debug(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds threshold. Using Multipart Upload.`);
    return uploadToR2Multipart(file, key, config, onProgress, signal);
  }

  // 1. Get Presigned URL (Standard PUT)
  const { uploadUrl, publicUrl } = await getPresignedUrl(config.workerUrl, key, file.type);

  // 2. Perform PUT upload with Retries and Progress
  await performUpload(uploadUrl, file, 3, onProgress, signal);

  return publicUrl;
};

/**
 * Handles R2 Multipart Upload for large files.
 */
async function uploadToR2Multipart(file: File, key: string, config: StorageConfig, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<string> {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // 1. Start Multipart Upload
  const startResp = await fetch(`${config.workerUrl}/multipart/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, type: file.type })
  });

  if (!startResp.ok) throw new Error(`Failed to start multipart upload: ${await startResp.text()}`);
  const { uploadId } = await startResp.json();

  // 2. Upload Chunks
  const parts: { etag: string; partNumber: number }[] = [];

  for (let i = 0; i < totalChunks; i++) {
    if (signal?.aborted) throw new Error('Upload cancelled');

    const start = i * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunk = file.slice(start, end);
    const partNumber = i + 1;

    // Get presigned URL for this part
    const { uploadUrl } = await getPresignedUrl(config.workerUrl, key, file.type, uploadId, partNumber);

    // Upload part and get ETag
    const etag = await performPartUpload(uploadUrl, chunk, 3, (partPercent) => {
      const overallProgress = ((i + partPercent / 100) / totalChunks) * 100;
      onProgress?.(overallProgress);
    }, signal);

    parts.push({ etag, partNumber });
  }

  // 3. Complete Multipart Upload
  const completeResp = await fetch(`${config.workerUrl}/multipart/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, uploadId, parts })
  });

  if (!completeResp.ok) throw new Error(`Failed to complete multipart upload: ${await completeResp.text()}`);
  const { publicUrl } = await completeResp.json();

  onProgress?.(100);
  return publicUrl;
}

/**
 * Helper: Safely extract folder name from FileList.
 * Chrome-safe: Uses 'in' operator to check property existence before access.
 * Handles cases where webkitRelativePath might be undefined, null, or inaccessible.
 */
function getFolderNameFromFileList(files: FileList): string {
  if (!files || files.length === 0) {
    return 'tileset';
  }

  const firstFile = files[0];
  if (!firstFile) {
    return 'tileset';
  }

  // Chrome-safe: Check if property exists using 'in' operator
  // This prevents errors when property access is restricted or unavailable
  try {
    if ('webkitRelativePath' in firstFile) {
      const relativePath = (firstFile as any).webkitRelativePath;

      if (relativePath && typeof relativePath === 'string' && relativePath.length > 0) {
        const rootPathPart = relativePath.split('/')[0];
        if (rootPathPart && rootPathPart.length > 0) {
          return rootPathPart.replace(/[^a-zA-Z0-9._-]/g, '_');
        }
      }
    }
  } catch (e) {
    // Silently fail if property access causes an error (Chrome security restrictions)
    // This can happen in certain browser contexts or security settings
    // Only log in development mode to avoid console noise in production
    logger.debug('Error accessing webkitRelativePath in getFolderNameFromFileList:', e);
  }

  // Fallback: use default name if webkitRelativePath is not available
  return 'tileset';
}

/**
 * Helper: Get relative path for a file, with fallback.
 * Chrome-safe: Uses 'in' operator to check property existence before access.
 */
function getRelativePath(file: File): string {
  if (!file) {
    return 'unknown';
  }

  // Chrome-safe: Check if property exists using 'in' operator
  try {
    if ('webkitRelativePath' in file) {
      const relativePath = (file as any).webkitRelativePath;

      if (relativePath && typeof relativePath === 'string' && relativePath.length > 0) {
        return relativePath;
      }
    }
  } catch (e) {
    // Silently fail if property access causes an error (Chrome security restrictions)
    // Only log in development mode to avoid console noise in production
    logger.debug('Error accessing webkitRelativePath in getRelativePath:', e);
  }

  // Fallback: use file name if webkitRelativePath is not available
  return file.name || 'unknown';
}

/**
 * Uploads a folder (FileList) maintaining structure using Presigned URLs.
 */
export const uploadFolderToR2 = async (files: FileList, type: LayerType, config: StorageConfig, onProgress?: (current: number, total: number) => void, signal?: AbortSignal): Promise<string> => {
  if (!config.workerUrl) {
    throw new Error("Missing Backend Worker URL");
  }

  // Validate FileList
  if (!files || files.length === 0) {
    throw new Error("No files selected. Please select a folder with files.");
  }

  const timestamp = Date.now();
  // Get root folder name or default - using safe helper function
  const rootFolderName = getFolderNameFromFileList(files);
  const uploadPrefix = `uploads/${type === LayerType.POTREE ? 'pointclouds' : 'tilesets'}/${timestamp}-${rootFolderName}`;

  let mainFileKey = "";

  // Progress Tracking (Byte-based)
  const fileArray = Array.from(files);
  const totalBytes = fileArray.reduce((acc, file) => acc + file.size, 0);
  const progressMap = new Map<string, number>(); // fileName -> bytesLoaded

  const updateProgress = () => {
    if (!onProgress) return;
    const totalLoaded = Array.from(progressMap.values()).reduce((acc, val) => acc + val, 0);
    // Return accumulated bytes and total bytes
    onProgress(totalLoaded, totalBytes);
  };

  // Concurrency limit
  const CONCURRENCY = 5;

  for (let i = 0; i < fileArray.length; i += CONCURRENCY) {
    // Check for cancellation before starting a batch
    if (signal?.aborted) {
      throw new Error('Upload cancelled');
    }

    const batch = fileArray.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (file) => {
      // Check for cancellation inside the loop (though handled by xhr as well)
      if (signal?.aborted) return;

      const relativePath = getRelativePath(file);
      const s3Key = `${uploadPrefix}/${relativePath}`;

      const lowerName = file.name.toLowerCase();

      // Detection logic
      if (type === LayerType.TILES_3D) {
        if (lowerName === 'tileset.json') mainFileKey = s3Key;
      } else if (type === LayerType.POTREE) {
        if (lowerName === 'cloud.js' || lowerName === 'metadata.json' || lowerName === 'ept.json') {
          // Prefer cloud.js if multiple exist, or just take the verified one
          if (!mainFileKey || lowerName === 'cloud.js') {
            mainFileKey = s3Key;
          }
        }
      }

      try {
        const { uploadUrl, publicUrl } = await getPresignedUrl(config.workerUrl, s3Key, file.type);

        if (type === LayerType.TILES_3D && lowerName === 'tileset.json') {
          mainFileKey = publicUrl;
        } else if (type === LayerType.POTREE && (lowerName === 'cloud.js' || lowerName === 'metadata.json' || lowerName === 'ept.json')) {
          if (!mainFileKey || lowerName === 'cloud.js' || !mainFileKey.includes('cloud.js')) {
            mainFileKey = publicUrl;
          }
        }

        // Pass a file-specific progress callback
        await performUpload(uploadUrl, file, 3, (filePercent) => {
          const bytesLoaded = (filePercent / 100) * file.size;
          progressMap.set(file.name, bytesLoaded);
          updateProgress();
        }, signal);

        // Ensure 100% is recorded for this file
        progressMap.set(file.name, file.size);
        updateProgress();

      } catch (err) {
        if (signal?.aborted || (err as Error).name === 'AbortError') {
          throw new Error('Upload cancelled');
        }
        logger.error(`Failed to upload ${file.name}`, err);
        throw new Error(`Failed to upload critical file: ${file.name}`);
      }
    }));
  }

  if (!mainFileKey) {
    // If cancelled, likely no key
    if (signal?.aborted) throw new Error('Upload cancelled');

    if (type === LayerType.TILES_3D) {
      throw new Error("No tileset.json found in the selected folder.");
    } else {
      throw new Error("Invalid Octree folder. Missing cloud.js or metadata.json.");
    }
  }

  return mainFileKey;
};

/**
 * Helper: Call the backend worker to get a presigned PUT URL.
 */
async function getPresignedUrl(workerUrl: string, key: string, type: string, uploadId?: string, partNumber?: number): Promise<PresignedResponse> {
  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key, type, uploadId, partNumber }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend Error (${response.status}): ${text}`);
  }

  return response.json();
}

/**
 * Deletes a file from R2 using the backend worker.
 * @param storagePath - The storage path or public URL of the file to delete
 * @param config - Storage configuration with worker URL
 * @param isPrefix - If true, deletes all files with this prefix (for 3D Tiles folders)
 */
export const deleteFromR2 = async (storagePath: string, config: StorageConfig, isPrefix: boolean = false): Promise<void> => {
  if (!config.workerUrl) {
    throw new Error("Missing Backend Worker URL");
  }

  logger.debug('[deleteFromR2] Starting delete:', { storagePath, isPrefix, workerUrl: config.workerUrl });

  const response = await fetch(`${config.workerUrl}/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key: storagePath, isPrefix }),
  });

  const responseData = await response.json().catch(() => ({}));
  logger.debug('[deleteFromR2] Response:', { status: response.status, ok: response.ok, data: responseData });

  if (!response.ok) {
    throw new Error(`Delete Error (${response.status}): ${JSON.stringify(responseData)}`);
  }

  logger.debug('[deleteFromR2] Delete successful:', responseData);
};

/**
 * Helper: Execute the PUT request to R2 with Exponential Backoff Retry and Progress.
 */
async function performUpload(url: string, file: File, retries = 3, onProgress?: (progress: number) => void, signal?: AbortSignal) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (signal?.aborted) throw new Error('Upload cancelled');

      const xhr = new XMLHttpRequest();

      return new Promise<void>((resolve, reject) => {
        // Handle AbortSignal
        if (signal) {
          signal.addEventListener('abort', () => {
            xhr.abort();
            reject(new Error('Upload cancelled'));
          });
        }

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const progress = (e.loaded / e.total) * 100;
            onProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            if (onProgress) onProgress(100);
            resolve();
          } else {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      });
    } catch (error) {
      if ((error as Error).message === 'Upload cancelled') {
        throw error;
      }
      if (attempt === retries - 1) {
        throw new Error(`Upload failed after ${retries} attempts: ${(error as Error).message}`);
      }
      // Wait before retry (exponential backoff)
      const delay = 500 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Uploads a single part/chunk and returns its ETag.
 */
async function performPartUpload(url: string, chunk: Blob, retries = 3, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (signal?.aborted) throw new Error('Upload cancelled');

      const xhr = new XMLHttpRequest();

      return new Promise<string>((resolve, reject) => {
        if (signal) {
          signal.addEventListener('abort', () => {
            xhr.abort();
            reject(new Error('Upload cancelled'));
          });
        }

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress((e.loaded / e.total) * 100);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const etag = xhr.getResponseHeader('ETag');
            if (!etag) reject(new Error('No ETag received from R2'));
            else resolve(etag);
          } else {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        xhr.open('PUT', url);
        xhr.send(chunk);
      });
    } catch (error) {
      if ((error as Error).message === 'Upload cancelled') throw error;
      if (attempt === retries - 1) throw error;
      const delay = 500 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Upload failed');
}

/**
 * Reliable delete from R2 with retries and progress callback.
 * Uses the working console script approach - 3 second delays, 15 attempts then 300s break.
 */
export interface DeleteProgress {
  currentAttempt: number;
  totalDeleted: number;
  totalErrors: number;
  status: 'running' | 'completed' | 'paused' | 'cancelled';
  message: string;
}

export const reliableDeleteFromR2 = async (
  storagePath: string,
  config: StorageConfig,
  isPrefix: boolean = false,
  onProgress?: (progress: DeleteProgress) => void,
  shouldCancel?: () => boolean
): Promise<{ totalDeleted: number; totalErrors: number }> => {
  if (!config.workerUrl) {
    throw new Error("Missing Backend Worker URL");
  }

  let totalDeleted = 0;
  let totalErrors = 0;
  let attempt = 0;
  const MAX_ATTEMPTS = 450;
  const DELAY_MS = 3000; // 3 seconds between attempts
  const PAUSE_EVERY = 20;
  const PAUSE_DURATION_MS = 120000; // 2 minutes

  while (attempt < MAX_ATTEMPTS) {
    // Check for cancellation
    if (shouldCancel && shouldCancel()) {
      onProgress?.({ currentAttempt: attempt, totalDeleted, totalErrors, status: 'cancelled', message: 'Cancelled by user' });
      break;
    }

    attempt++;

    try {
      const response = await fetch(`${config.workerUrl}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: storagePath, isPrefix }),
      });

      const data = await response.json().catch(() => ({ deleted: 0, errors: 0 }));
      totalDeleted += data.deleted || 0;
      totalErrors += data.errors || 0;

      onProgress?.({
        currentAttempt: attempt,
        totalDeleted,
        totalErrors,
        status: 'running',
        message: `Attempt ${attempt}: deleted ${data.deleted}, errors ${data.errors}`
      });

      // If nothing left to delete, we're done
      if ((data.deleted === 0 || data.deleted === undefined) && (data.errors === 0 || data.errors === undefined)) {
        onProgress?.({ currentAttempt: attempt, totalDeleted, totalErrors, status: 'completed', message: 'All files deleted!' });
        break;
      }

      // Pause every 20 attempts for 2 minutes
      if (attempt % PAUSE_EVERY === 0 && attempt < MAX_ATTEMPTS) {
        onProgress?.({
          currentAttempt: attempt,
          totalDeleted,
          totalErrors,
          status: 'paused',
          message: `Pausing for 2 minutes after ${PAUSE_EVERY} attempts...`
        });
        await new Promise(resolve => setTimeout(resolve, PAUSE_DURATION_MS));
      }

    } catch (e: any) {
      logger.error(`[reliableDeleteFromR2] Attempt ${attempt} error:`, e.message);
    }

    // Wait between attempts
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  return { totalDeleted, totalErrors };
};

/**
 * Wipe all R2 storage (dangerous operation!)
 */
export const wipeAllR2Storage = async (
  config: StorageConfig,
  onProgress?: (progress: DeleteProgress) => void,
  shouldCancel?: () => boolean
): Promise<{ totalDeleted: number; totalErrors: number }> => {
  return reliableDeleteFromR2('root', config, true, onProgress, shouldCancel);
};