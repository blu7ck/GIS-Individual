import { StorageConfig } from "../types";
import { logger } from "../utils/logger";

// Interface for the response from the Worker
interface PresignedResponse {
  uploadUrl: string;
  publicUrl: string;
}

/**
 * Uploads a single file using a Presigned URL flow.
 */
export const uploadToR2 = async (file: File, config: StorageConfig, onProgress?: (progress: number) => void): Promise<string> => {
  if (!config.workerUrl) {
    throw new Error("Missing Backend Worker URL");
  }

  // 1. Generate unique key
  // Sanitize filename: remove spaces, special chars that might break URLs
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `uploads/${Date.now()}-${sanitizedName}`;

  // 2. Get Presigned URL
  const { uploadUrl, publicUrl } = await getPresignedUrl(config.workerUrl, key, file.type);

  // 3. Perform PUT upload with Retries and Progress
  await performUpload(uploadUrl, file, 3, onProgress);

  return publicUrl;
};

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
export const uploadFolderToR2 = async (files: FileList, config: StorageConfig, onProgress?: (current: number, total: number) => void): Promise<string> => {
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
  const uploadPrefix = `uploads/tilesets/${timestamp}-${rootFolderName}`;

  let tilesetKey = "";
  let uploadedCount = 0;
  const totalFiles = files.length;

  const fileArray = Array.from(files);

  // Concurrency limit
  const CONCURRENCY = 5;

  for (let i = 0; i < fileArray.length; i += CONCURRENCY) {
    const batch = fileArray.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (file) => {
      const relativePath = getRelativePath(file);
      const s3Key = `${uploadPrefix}/${relativePath}`;

      if (file.name.toLowerCase() === 'tileset.json') {
        tilesetKey = s3Key;
      }

      try {
        const { uploadUrl, publicUrl } = await getPresignedUrl(config.workerUrl, s3Key, file.type);

        if (file.name.toLowerCase() === 'tileset.json') {
          tilesetKey = publicUrl;
        }

        await performUpload(uploadUrl, file);

        uploadedCount++;
        if (onProgress) onProgress(uploadedCount, totalFiles);
      } catch (err) {
        logger.error(`Failed to upload ${file.name}`, err);
        throw new Error(`Failed to upload critical file: ${file.name}`);
      }
    }));
  }

  if (!tilesetKey) {
    throw new Error("No tileset.json found in the selected folder.");
  }

  return tilesetKey;
};

/**
 * Helper: Call the backend worker to get a presigned PUT URL.
 */
async function getPresignedUrl(workerUrl: string, key: string, type: string): Promise<PresignedResponse> {
  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key, type }),
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
async function performUpload(url: string, file: File, retries = 3, onProgress?: (progress: number) => void) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const xhr = new XMLHttpRequest();

      return new Promise<void>((resolve, reject) => {
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

        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      });
    } catch (error) {
      if (attempt === retries - 1) {
        throw new Error(`Upload failed after ${retries} attempts: ${(error as Error).message}`);
      }
      // Wait before retry (exponential backoff: 500ms, 1000ms, 2000ms)
      const delay = 500 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
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
  const PAUSE_EVERY = 15;
  const PAUSE_DURATION_MS = 300000; // 5 minutes

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

      // Pause every 15 attempts for 5 minutes
      if (attempt % PAUSE_EVERY === 0 && attempt < MAX_ATTEMPTS) {
        onProgress?.({
          currentAttempt: attempt,
          totalDeleted,
          totalErrors,
          status: 'paused',
          message: `Pausing for 5 minutes after ${PAUSE_EVERY} attempts...`
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
  return reliableDeleteFromR2('uploads/', config, true, onProgress, shouldCancel);
};