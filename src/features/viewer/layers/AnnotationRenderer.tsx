import React from 'react';
import { AssetLayer } from '../../../../types';

interface AnnotationRendererProps {
    layers: AssetLayer[];
    viewer?: any; // Will be passed if needed
}

/**
 * AnnotationRenderer - Placeholder for layer annotations
 * Currently returns null as annotations are handled elsewhere
 * This can be expanded to render labels, markers, etc. for layers
 */
export const AnnotationRenderer: React.FC<AnnotationRendererProps> = ({ layers: _layers }) => {
    // Annotations would be managed imperatively similar to MeasurementRenderer
    // For now, this is a no-op placeholder
    return null;
};
