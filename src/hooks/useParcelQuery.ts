/**
 * Parcel Query Hook - Orchestrates TKGM API, Metrics, Elevation, and Persistence
 */
import { useState, useCallback, useEffect } from 'react';
import * as Cesium from 'cesium';
import {
    ParcelQueryInput,
    ParcelResult,
    AdminHierarchyNode,
    SavedParcelQuery,
    ParcelElevation
} from '../shared/parcel/types';
import { defaultTkgmClient } from '../server/parcel/tkgm.client';
import { computeParcelMetrics } from '../server/parcel/geom.metrics';
import { parcelQueryService } from '../server/parcel/parcel.service';
import { parcelToKml, downloadKml } from '../server/parcel/kml';
import { StorageConfig } from '../types';
import { logger } from '../utils/logger';

interface UseParcelQueryProps {
    viewer: Cesium.Viewer | null;
    storageConfig?: StorageConfig | null;
    userId?: string | null;
    onAssetsChange?: () => void;
}

export function useParcelQuery({ viewer, storageConfig, userId, onAssetsChange }: UseParcelQueryProps) {
    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentResult, setCurrentResult] = useState<ParcelResult | null>(null);
    const [isQueryMode, setIsQueryMode] = useState(false);

    // Administrative Hierarchy State
    const [provinces, setProvinces] = useState<AdminHierarchyNode[]>([]);
    const [districts, setDistricts] = useState<AdminHierarchyNode[]>([]);
    const [neighborhoods, setNeighborhoods] = useState<AdminHierarchyNode[]>([]);

    // History & DB State
    const [sessionHistory, setSessionHistory] = useState<ParcelResult[]>([]);
    const [savedQueries, setSavedQueries] = useState<SavedParcelQuery[]>([]);

    // Load initial data
    useEffect(() => {
        const loadProvinces = async () => {
            try {
                const data = await defaultTkgmClient.getProvinces();
                if (Array.isArray(data)) {
                    setProvinces(data);
                } else {
                    logger.warn('Provinces data is not an array:', data);
                    setProvinces([]);
                }
            } catch (err) {
                logger.error('Failed to load provinces:', err);
            }
        };

        const loadSessionHistory = () => {
            const stored = sessionStorage.getItem('parcel_query_history');
            if (stored) {
                try {
                    setSessionHistory(JSON.parse(stored));
                } catch (e) {
                    logger.error('Failed to parse session history');
                }
            }
        };

        loadProvinces();
        loadSessionHistory();
    }, []);

    // Load saved queries when userId is available
    useEffect(() => {
        if (userId && storageConfig) {
            refreshSavedQueries();
        }
    }, [userId, storageConfig]);

    const refreshSavedQueries = async () => {
        if (!userId || !storageConfig) return;
        try {
            const data = await parcelQueryService.listQueries(userId, storageConfig);
            setSavedQueries(data);
        } catch (err) {
            logger.error('Failed to load saved queries:', err);
        }
    };

    /**
     * Sample elevation from Cesium terrain for a parcel geometry
     */
    const sampleElevation = useCallback(async (geometry: any): Promise<ParcelElevation | null> => {
        if (!viewer || viewer.isDestroyed()) return null;

        const coords = geometry.type === 'Polygon'
            ? geometry.coordinates[0]
            : geometry.coordinates[0][0];

        const points = coords.map(([lon, lat]: [number, number]) =>
            Cesium.Cartographic.fromDegrees(lon, lat)
        );

        try {
            // Sampling terrain for vertices
            const sampledPoints = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, points);

            const results = sampledPoints.map((p, i) => ({
                lon: coords[i][0],
                lat: coords[i][1],
                elevation: p.height || 0
            }));

            const elevs = results.map(r => r.elevation);
            return {
                min_m: Math.min(...elevs),
                max_m: Math.max(...elevs),
                mean_m: elevs.reduce((a, b) => a + b, 0) / elevs.length,
                points: results
            };
        } catch (e) {
            logger.warn('Elevation sampling failed:', e);
            return null;
        }
    }, [viewer]);

    /**
     * Primary Query function
     */
    const executeQuery = useCallback(async (input: ParcelQueryInput) => {
        setIsLoading(true);
        setError(null);
        try {
            const feature = await defaultTkgmClient.fetchParcel(input);

            // Get Elevation from terrain
            const elevation = await sampleElevation(feature.geometry);

            // Compute Engineering Metrics
            const metrics = computeParcelMetrics(feature, elevation || undefined);

            // Stable Query Key
            const query_key = input.mode === 'by_admin'
                ? `${input.mahalleId}-${input.adaNo}-${input.parselNo}`
                : `${input.lat.toFixed(6)}-${input.lon.toFixed(6)}`;

            const result: ParcelResult = {
                feature,
                metrics,
                elevation: elevation || undefined,
                query_key
            };

            setCurrentResult(result);
            flyToParcel(result);

            // Add to session history
            setSessionHistory(prev => {
                const updated = [result, ...prev.filter(r => r.query_key !== query_key)].slice(0, 20);
                sessionStorage.setItem('parcel_query_history', JSON.stringify(updated));
                return updated;
            });

            // Disable query mode after successful query
            setIsQueryMode(false);

            return result;
        } catch (err: any) {
            const msg = err.message || 'Parsel sorgulanamadı';
            setError(msg);
            logger.error('Query error:', err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [sampleElevation]);

    /**
     * Save to DB
     */
    const saveResult = async (result: ParcelResult, customName: string, projectId?: string) => {
        if (!userId || !storageConfig) {
            setError('Kaydetmek için oturum açmalısınız');
            return;
        }

        try {
            const mode = result.query_key.includes('-') ? 'by_admin' : 'by_click';

            // 1. Save to DB table
            await parcelQueryService.saveQuery(userId, customName, result, mode, storageConfig);

            // 2. Optional: Save as KML asset for ProjectPanel
            if (projectId) {
                await parcelQueryService.saveAsAsset(projectId, result, storageConfig);
            }

            await refreshSavedQueries();
            // Trigger external asset refresh
            onAssetsChange?.();
        } catch (err) {
            logger.error('Save failed:', err);
            setError('Kaydedilemedi');
        }
    };

    /**
     * Delete from DB
     */
    const deleteSaved = async (id: string) => {
        if (!storageConfig) return;
        try {
            await parcelQueryService.deleteQuery(id, storageConfig);
            setSavedQueries(prev => prev.filter(q => q.id !== id));
        } catch (err) {
            logger.error('Delete failed:', err);
        }
    };

    /**
     * Load districts/neighborhoods for dropdowns
     */
    const fetchDistricts = async (ilId: number | string) => {
        setDistricts([]);
        setNeighborhoods([]);
        try {
            const data = await defaultTkgmClient.getDistricts(ilId);
            setDistricts(data);
        } catch (e) { logger.error(e); }
    };

    const fetchNeighborhoods = async (ilceId: number | string) => {
        setNeighborhoods([]);
        try {
            const data = await defaultTkgmClient.getNeighborhoods(ilceId);
            setNeighborhoods(data);
        } catch (e) { logger.error(e); }
    };

    /**
     * Fly to parcel boundary
     */
    const flyToParcel = useCallback((result: ParcelResult | SavedParcelQuery) => {
        if (!viewer || viewer.isDestroyed()) return;

        // metrics.bbox: { minLon, minLat, maxLon, maxLat }
        const { bbox } = result.metrics;
        viewer.camera.flyTo({
            destination: Cesium.Rectangle.fromDegrees(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat),
            duration: 2
        });
    }, [viewer]);

    return {
        // State
        isLoading,
        error,
        currentResult,
        isQueryMode,
        provinces,
        districts,
        neighborhoods,
        sessionHistory,
        savedQueries,

        // Setters
        setIsQueryMode,
        setCurrentResult,

        // Actions
        executeQuery,
        saveResult,
        deleteSaved,
        fetchDistricts,
        fetchNeighborhoods,
        flyToParcel,
        exportKml: (result: ParcelResult, name: string) => {
            const kml = parcelToKml(result, name);
            downloadKml(kml, name);
        },
        clearResult: () => setCurrentResult(null)
    };
}
