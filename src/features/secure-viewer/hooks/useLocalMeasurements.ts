import { useState } from 'react';
import { AssetLayer, MeasurementMode, LayerType } from '../../../types';

export function useLocalMeasurements() {
    const [localMeasurements, setLocalMeasurements] = useState<AssetLayer[]>([]);
    const [measurementMode, setMeasurementMode] = useState<MeasurementMode>(MeasurementMode.NONE);
    const [measurementToolbarOpen, setMeasurementToolbarOpen] = useState(true);

    const addMeasurement = (result: string, geometry: any) => {
        if (!geometry) return;

        // Extract numerical value from result string
        const valueMatch = result.match(/:\s*(.+)$/);
        const measurementValue = valueMatch?.[1]?.trim() || result;

        const newMeasurement: AssetLayer = {
            id: `local-${Date.now()}`,
            name: `Measurement: ${measurementValue}`,
            type: LayerType.ANNOTATION,
            storage_path: 'local', // Local measurement - not stored in R2
            url: '',
            visible: true,
            opacity: 0.7,
            project_id: 'viewer-local',
            data: {
                ...geometry,
                value: measurementValue
            }
        };

        setLocalMeasurements(prev => [...prev, newMeasurement]);
        setMeasurementMode(MeasurementMode.NONE);
    };

    const clearMeasurements = () => {
        setLocalMeasurements([]);
        setMeasurementMode(MeasurementMode.NONE);
    };

    return {
        measurements: localMeasurements, // Renamed for consistency with external API expectations
        measurementMode,
        setMeasurementMode,
        measurementToolbarOpen,
        setMeasurementToolbarOpen,
        addMeasurement,
        clearMeasurements
    };
}
