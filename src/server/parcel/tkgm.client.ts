/**
 * TKGM (Tapu ve Kadastro Genel Müdürlüğü) API Client
 */
import { ParcelQueryInput, TkgmGeoJsonFeature, AdminHierarchyNode } from '../../shared/parcel/types';
import { logger } from '../../utils/logger';

// Default base URLs - Configurable via environment or props
const TKGM_BASE_V3 = import.meta.env.VITE_TKGM_BASE_V3 || 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3';
const TKGM_BASE_V3_1 = import.meta.env.VITE_TKGM_BASE_V3_1 || 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1';

export class TkgmClient {
    private baseV3: string;
    private baseV31: string;

    constructor(config?: { baseV3?: string; baseV31?: string }) {
        this.baseV3 = config?.baseV3 || TKGM_BASE_V3;
        this.baseV31 = config?.baseV31 || TKGM_BASE_V3_1;
    }

    /**
     * Fetch parcel data from TKGM based on input (coordinate or admin details)
     */
    async fetchParcel(input: ParcelQueryInput): Promise<TkgmGeoJsonFeature> {
        let url: string;

        if (input.mode === 'by_admin') {
            const { mahalleId, adaNo, parselNo } = input;
            url = `${this.baseV3}/api/parsel/${encodeURIComponent(String(mahalleId))}/${encodeURIComponent(String(adaNo))}/${encodeURIComponent(String(parselNo))}`;
        } else {
            // Variant for lat/lon query usually uses v3.1
            const { lat, lon } = input;
            url = `${this.baseV31}/api/parsel/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lon))}/`;
        }

        logger.debug('[TkgmClient] Fetching parcel from:', url);

        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'accept': 'application/json' },
            });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`TKGM API Error ${res.status}: ${text.slice(0, 300)}`);
            }

            const data = await res.json();

            // Validate response structure
            if (!data || data.type !== 'Feature') {
                throw new Error('Invalid TKGM parcel response: Not a GeoJSON Feature');
            }

            return data as TkgmGeoJsonFeature;
        } catch (error: any) {
            logger.error('[TkgmClient] Fetch failed:', error);
            throw error;
        }
    }

    /**
     * Get Province (İl) list
     */
    async getProvinces(): Promise<AdminHierarchyNode[]> {
        const url = `${this.baseV3}/api/idariYapi/ilListe`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch provinces');
        const data = await res.json();
        return this.normalizeAdminList(data);
    }

    /**
     * Get District (İlçe) list for a province
     */
    async getDistricts(ilId: number | string): Promise<AdminHierarchyNode[]> {
        const url = `${this.baseV3}/api/idariYapi/ilceListe/${ilId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch districts for il ${ilId}`);
        const data = await res.json();
        return this.normalizeAdminList(data);
    }

    /**
     * Get Neighborhood (Mahalle) list for a district
     */
    async getNeighborhoods(ilceId: number | string): Promise<AdminHierarchyNode[]> {
        const url = `${this.baseV3}/api/idariYapi/mahalleListe/${ilceId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch neighborhoods for ilce ${ilceId}`);
        const data = await res.json();
        return this.normalizeAdminList(data);
    }

    /**
     * Normalizes TKGM admin lists which can be simple arrays or GeoJSON FeatureCollections
     */
    private normalizeAdminList(data: any): AdminHierarchyNode[] {
        if (Array.isArray(data)) return data;

        // Handle GeoJSON FeatureCollection
        if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
            return data.features.map((f: any) => ({
                id: f.properties.id || f.id || 0,
                text: f.properties.ad || f.properties.text || f.properties.name || 'Unknown'
            }));
        }

        logger.warn('[TkgmClient] Unexpected admin list format:', data);
        return [];
    }
}

export const defaultTkgmClient = new TkgmClient();
