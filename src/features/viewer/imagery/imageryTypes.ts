import {
    ArcGisMapServerImageryProvider,
    UrlTemplateImageryProvider,
    IonImageryProvider,
    ImageryProvider
} from 'cesium';
import { MapType } from '../../../types';

export type ImageryProviderType =
    | ArcGisMapServerImageryProvider
    | UrlTemplateImageryProvider
    | IonImageryProvider
    | ImageryProvider;

export interface ImageryState {
    currentProvider: ImageryProviderType | null;
    error: string | null;
    isLoading: boolean;
}

export type { MapType };
