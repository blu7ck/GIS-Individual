import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Project, AssetLayer, StorageConfig } from '../types';
import { createSupabaseClient } from '../lib/supabase';
import { NotificationType } from '../components/common/Notification';

export function useSharing(
    storageConfig: StorageConfig | null,
    notify: (msg: string, type: NotificationType) => void
) {
    const [sharingAsset, setSharingAsset] = useState<AssetLayer | null>(null);
    const [sharingProject, setSharingProject] = useState<Project | null>(null);

    const handleShareLayer = (asset: AssetLayer) => {
        setSharingAsset(asset);
    };

    const handleShareProject = (project: Project) => {
        setSharingProject(project);
    };

    const executeShare = async (email: string, pin: string, hours: number) => {
        if (!sharingAsset) {
            notify("No asset selected for sharing", "error");
            return '';
        }

        // Generate Share ID
        const shareId = uuidv4();
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        const link = `${window.location.origin}?share_id=${shareId}`;

        // Save to Supabase
        if (storageConfig?.supabaseUrl && storageConfig?.supabaseKey) {
            try {
                const supabase = createSupabaseClient(storageConfig.supabaseUrl, storageConfig.supabaseKey);

                // Simple PIN hash (base64 encode for now - in production use proper hashing)
                const pinHash = btoa(pin).replace(/[^a-zA-Z0-9]/g, '');

                const { error } = await supabase
                    .from('shared_links')
                    .insert({
                        id: shareId,
                        asset_id: sharingAsset.id,
                        pin_hash: pinHash,
                        viewer_email: email,
                        expires_at: expiresAt
                    });

                if (error) {
                    console.error('Error saving share link:', error);
                    notify('Failed to create share link', 'error');
                    return '';
                }
            } catch (e: any) {
                console.error('Error creating share link:', e);
                notify('Failed to create share link', 'error');
                return '';
            }
        }

        // Call Backend to Send Email
        if (storageConfig?.workerUrl) {
            try {
                const response = await fetch(`${storageConfig.workerUrl}/send-share-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: email,
                        pin,
                        shareLink: link,
                        assetName: sharingAsset.name || 'Shared Asset',
                        hours
                    })
                });

                if (!response.ok) {
                    // Fallback if email fails but link created
                    notify('Link created but email failed to send', 'warning');
                } else {
                    notify(`Share link sent to ${email}`, 'success');
                }

            } catch (e) {
                notify('Link created but email failed to send', 'warning');
            }
        } else {
            // No worker URL, just show success for link creation
            notify('Share link created', 'success');
        }

        setSharingAsset(null);
        return link;
    };

    const executeProjectShare = async (
        email: string,
        pin: string,
        hours: number,
        selectedAssetIds: string[]
    ): Promise<string> => {
        if (!sharingProject) {
            notify("No project selected for sharing", "error");
            return '';
        }

        const shareId = uuidv4();
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        const link = `${window.location.origin}?share_id=${shareId}`;

        if (storageConfig?.supabaseUrl && storageConfig?.supabaseKey) {
            try {
                const supabase = createSupabaseClient(storageConfig.supabaseUrl, storageConfig.supabaseKey);
                const pinHash = btoa(pin).replace(/[^a-zA-Z0-9]/g, '');

                const { error } = await supabase
                    .from('shared_links')
                    .insert({
                        id: shareId,
                        project_id: sharingProject.id,
                        asset_ids: selectedAssetIds, // Note: DB schema must support this array or relation
                        pin_hash: pinHash,
                        viewer_email: email,
                        expires_at: expiresAt
                    });

                if (error) {
                    console.error('Error saving project share link:', error);
                    notify('Failed to create project share link', 'error');
                    return '';
                }
            } catch (e) {
                console.error('Error sharing project:', e);
                notify('Failed to create project share link', 'error');
                return '';
            }
        }

        if (storageConfig?.workerUrl) {
            try {
                await fetch(`${storageConfig.workerUrl}/send-share-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: email,
                        pin,
                        shareLink: link,
                        assetName: `Project: ${sharingProject.name}`,
                        hours
                    })
                });
                notify(`Project share link sent to ${email}`, 'success');
            } catch (e) {
                notify('Link created but email failed', 'warning');
            }
        }

        setSharingProject(null);
        return link;
    };

    return {
        sharingAsset,
        setSharingAsset,
        sharingProject,
        setSharingProject,
        handleShareLayer,
        handleShareProject,
        executeShare,
        executeProjectShare
    };
}
