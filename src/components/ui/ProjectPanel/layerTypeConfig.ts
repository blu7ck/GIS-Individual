/**
 * Layer Type Configuration
 * Central config for layer icons, colors, and labels
 */
import { FileBox, Box, Map } from 'lucide-react';
import { LayerType } from '../../../types';

export interface LayerTypeStyle {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    hoverColor: string;
    label: string;
}

export const LAYER_TYPE_CONFIG: Partial<Record<LayerType, LayerTypeStyle>> = {
    [LayerType.KML]: {
        icon: FileBox,
        color: 'text-[#EA580C]',
        hoverColor: 'hover:text-[#EA580C]',
        label: 'KML Files',
    },
    [LayerType.TILES_3D]: {
        icon: FileBox,
        color: 'text-carta-forest-400',
        hoverColor: 'hover:text-carta-forest-400',
        label: '3D Tiles',
    },
    [LayerType.DXF]: {
        icon: FileBox,
        color: 'text-[#EC4899]',
        hoverColor: 'hover:text-[#EC4899]',
        label: 'DXF Files',
    },
    [LayerType.SHP]: {
        icon: FileBox,
        color: 'text-[#06B6D4]',
        hoverColor: 'hover:text-[#06B6D4]',
        label: 'Shapefiles',
    },
    [LayerType.GLB_UNCOORD]: {
        icon: Box,
        color: 'text-[#A855F7]',
        hoverColor: 'hover:text-[#A855F7]',
        label: 'GLB/GLTF',
    },
    [LayerType.ANNOTATION]: {
        icon: Map,
        color: 'text-carta-gold-500',
        hoverColor: 'hover:text-carta-gold-400',
        label: 'Measurements',
    },
};

export function getLayerTypeStyle(type: LayerType): LayerTypeStyle {
    return LAYER_TYPE_CONFIG[type] || {
        icon: FileBox,
        color: 'text-gray-400',
        hoverColor: 'hover:text-gray-300',
        label: 'Unknown',
    };
}
