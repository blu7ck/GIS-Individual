import { useState, useCallback } from 'react';
import { AssetLayer } from '../../../types';

interface UseSecureAuthResult {
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string;
    handleUnlock: (pin: string) => Promise<AssetLayer[] | null>;
    setIsAuthenticated: (value: boolean) => void;
    setError: (error: string) => void;
}

export function useSecureAuth(shareId: string, workerUrl: string): UseSecureAuthResult {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleUnlock = useCallback(async (pin: string): Promise<AssetLayer[] | null> => {
        setIsLoading(true);
        setError('');

        try {
            // Call Worker
            const response = await fetch(`${workerUrl}/verify-share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shareId, pin })
            });

            if (!response.ok) {
                throw new Error('Invalid PIN or Access Denied');
            }

            const data = await response.json();
            let parsedLayers: AssetLayer[] = [];

            // Data.layers should contain the main asset and any public annotations
            // Set all layers to invisible by default (unseen) for secure viewer
            // Map database column names (snake_case) to TS property names (camelCase)
            if (data.layers && Array.isArray(data.layers)) {
                // Debug: Log worker response to check height_offset
                console.log('[SecureViewer] Worker response layers:', data.layers.map((l: any) => ({
                    id: l.id,
                    name: l.name,
                    type: l.type,
                    height_offset: l.height_offset,
                    heightOffset: l.heightOffset
                })));

                parsedLayers = data.layers.map((layer: any) => ({
                    ...layer,
                    visible: false,
                    heightOffset: layer.height_offset || 0, // Map DB column to TS property
                    scale: layer.scale || 1,
                }));
            } else {
                // Fallback for legacy single asset
                parsedLayers = [{
                    ...data,
                    project_id: 'shared',
                    visible: false,
                    opacity: 1,
                    heightOffset: data.height_offset || 0,
                    scale: data.scale || 1,
                }];
            }

            setIsLoading(false);
            return parsedLayers;

        } catch (err: any) {
            console.error('Unlock failed:', err);
            setError(err.message || 'Authentication failed');
            setIsLoading(false);
            return null;
        }
    }, [shareId, workerUrl]);

    return {
        isAuthenticated,
        isLoading,
        error,
        handleUnlock,
        setIsAuthenticated,
        setError
    };
}
