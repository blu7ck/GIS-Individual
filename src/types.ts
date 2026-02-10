

export enum MapType {
  STANDARD = 'STANDARD', // Kartografik
  SATELLITE = 'SATELLITE', // Uydu
  OPENSTREETMAP = 'OPENSTREETMAP',
  TERRAIN_3D = 'TERRAIN_3D'
}

export enum LayerType {
  KML = 'KML',
  GEOJSON = 'GEOJSON',
  DXF = 'DXF',
  SHP = 'SHP',
  GLB_UNCOORD = 'GLB_UNCOORD',
  TILES_3D = 'TILES_3D',
  ANNOTATION = 'ANNOTATION', // New type for saved drawings
  POTREE = 'POTREE', // Processed Octree (cloud.js / metadata.json)
  LAS = 'LAS' // Raw Point Cloud (LAS/LAZ)
}

export enum AssetStatus {
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR'
}

// Scene Modes
export enum SceneViewMode {
  SCENE3D = 3, // Matches Cesium.SceneMode.SCENE3D
  SCENE2D = 2,
  COLUMBUS_VIEW = 1
}

// Database Models
export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  parent_project_id?: string | null; // For folder structure: null = root project, string = sub-project (e.g., Measurements folder)
  is_measurements_folder?: boolean; // Flag to identify auto-generated measurements folders
  linked_asset_id?: string | null; // For 3D Tiles measurements: links to the asset this measurements folder belongs to
}

export interface AssetLayer {
  id: string;
  project_id: string;
  name: string;
  type: LayerType;
  storage_path: string; // Path in R2
  url?: string; // Renamed from public_url to url to match usage
  blobUrl?: string; // Added for local previews
  position?: { lat: number; lng: number; height: number };
  visible: boolean;
  opacity: number;
  data?: any; // For annotations (GeoJSON content)
  heightOffset?: number; // Runtime-only: 3D Tiles ve GLB için manuel yükseklik offset (metre)
  offsetX?: number; // Manuel X kaydırma (metre)
  offsetY?: number; // Manuel Y kaydırma (metre)
  rotation?: number; // Manuel rotasyon (derece)
  scale?: number; // Runtime-only: 3D Tiles ve GLB için ölçek faktörü (default: 1.0)
  status?: AssetStatus; // Processing status for LAS/LAZ
  potree_url?: string; // URL to Potree octree output (for PotreeViewer)
  tiles_url?: string; // URL to 3D Tiles output (for Cesium)
  error_message?: string; // Error details if processing failed
  metadata?: {
    pointCount?: number;
    formatVersion?: string;
    boundingBox?: any;
    heightOffset?: number;
  };
}

export type Layer = AssetLayer; // Export alias for components using 'Layer'

export interface ShareLink {
  id: string;
  asset_id: string;
  pin_hash?: string; // We will store this locally or in DB
  expires_at: string;
  viewer_email: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'owner' | 'viewer';
}

export interface StorageConfig {
  workerUrl: string;
  supabaseUrl?: string;
  supabaseKey?: string;
}

export enum MeasurementMode {
  NONE = 'NONE',
  DISTANCE = 'DISTANCE',
  AREA = 'AREA',
  DRAW_POLYGON = 'DRAW_POLYGON',
  VOLUME = 'VOLUME',
  PROFILE = 'PROFILE',
  SPOT_HEIGHT = 'SPOT_HEIGHT',
  SLOPE = 'SLOPE',
  CONVEX_HULL = 'CONVEX_HULL',
  LINE_OF_SIGHT = 'LINE_OF_SIGHT'
}

// Kalite seviyesi enum
export enum QualityLevel {
  LOW = 'LOW',       // Düşük - pil tasarrufu
  MEDIUM = 'MEDIUM', // Orta - dengeli
  HIGH = 'HIGH',     // Yüksek - güzel görüntü
  ULTRA = 'ULTRA'    // Ultra - maksimum kalite
}

// Performans modu
export enum PerformanceMode {
  BATTERY_SAVER = 'BATTERY_SAVER',     // Pil tasarrufu
  BALANCED = 'BALANCED',                // Dengeli
  HIGH_PERFORMANCE = 'HIGH_PERFORMANCE' // Yüksek performans
}

// Kalite ayarları interface
export interface QualitySettings {
  qualityLevel: QualityLevel;
  performanceMode: PerformanceMode;
  maximumScreenSpaceError: number; // 3D Tiles için (1-16)
  tileCacheSize: number;           // Globe tile cache
  textureCacheSize: number;        // Texture cache (MB)
  cacheBytes: number;              // 3D Tiles cache (bytes)
  skipLevels: number;              // LOD skip levels
  baseScreenSpaceError: number;    // Base SSE for 3D Tiles
}

// Kalite preset değerleri
export const QUALITY_PRESETS: Record<QualityLevel, Omit<QualitySettings, 'qualityLevel' | 'performanceMode'>> = {
  [QualityLevel.LOW]: {
    maximumScreenSpaceError: 16,
    tileCacheSize: 200,
    textureCacheSize: 64,
    cacheBytes: 32 * 1024 * 1024,
    skipLevels: 4,
    baseScreenSpaceError: 4096
  },
  [QualityLevel.MEDIUM]: {
    maximumScreenSpaceError: 4,
    tileCacheSize: 500,
    textureCacheSize: 128,
    cacheBytes: 128 * 1024 * 1024,
    skipLevels: 2,
    baseScreenSpaceError: 2048
  },
  [QualityLevel.HIGH]: {
    maximumScreenSpaceError: 2,
    tileCacheSize: 1000,
    textureCacheSize: 512,
    cacheBytes: 512 * 1024 * 1024,
    skipLevels: 1,
    baseScreenSpaceError: 1024
  },
  [QualityLevel.ULTRA]: {
    maximumScreenSpaceError: 0,      // Maksimum detay - tüm tile'lar yüklenir
    tileCacheSize: 4000,             // Çok yüksek tile cache
    textureCacheSize: 2048,          // 2GB texture cache
    cacheBytes: 2 * 1024 * 1024 * 1024, // 2GB 3D Tiles cache
    skipLevels: 0,                   // Hiçbir LOD atlanmaz
    baseScreenSpaceError: 1          // Minimum base SSE - gerçek ULTRA kalite
  }
};

// Default kalite ayarları oluştur
export const getDefaultQualitySettings = (): QualitySettings => {
  const defaultLevel = QualityLevel.MEDIUM;
  const preset = QUALITY_PRESETS[defaultLevel];
  return {
    qualityLevel: defaultLevel,
    performanceMode: PerformanceMode.BALANCED,
    ...preset
  };
};