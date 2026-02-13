import { Ruler, Square, ArrowUp, TrendingUp, Eye, Hexagon, Activity, Box } from 'lucide-react';
import { MeasurementMode, PerformanceMode } from '../../types';
import { ToolbarItem } from '../ui/ToolbarItem';

interface Props {
    activeMode: MeasurementMode;
    onSetMode: (mode: MeasurementMode) => void;
    isOpen: boolean;
    onToggle: () => void;
    performanceMode?: PerformanceMode;
}

export const MeasurementTool: React.FC<Props> = ({ activeMode, onSetMode, isOpen, onToggle, performanceMode }) => {

    const tools = [
        { mode: MeasurementMode.DISTANCE, label: 'Mesafe', icon: <Ruler size={18} />, category: 'Temel', color: '#FBBF24' },
        { mode: MeasurementMode.AREA, label: 'Alan', icon: <Square size={18} />, category: 'Temel', color: '#F97316' },
        { mode: MeasurementMode.SPOT_HEIGHT, label: 'Rakım', icon: <ArrowUp size={18} />, category: 'Analiz', color: '#D946EF' },
        { mode: MeasurementMode.SLOPE, label: 'Eğim', icon: <TrendingUp size={18} />, category: 'Analiz', color: '#84CC16' },
        { mode: MeasurementMode.LINE_OF_SIGHT, label: 'Görüş', icon: <Eye size={18} />, category: 'Analiz', color: '#06B6D4' },
        { mode: MeasurementMode.CONVEX_HULL, label: 'Zarf', icon: <Hexagon size={18} />, category: 'Analiz', color: '#A855F7' },
        { mode: MeasurementMode.PROFILE, label: 'Profil', icon: <Activity size={18} />, category: 'Analiz', color: '#3B82F6' },
        { mode: MeasurementMode.VOLUME, label: 'Hacim', icon: <Box size={18} />, category: 'Analiz', color: '#D97706' }, // Lightened brown for UI visibility
    ];

    return (
        <ToolbarItem
            icon={<Ruler size={20} />}
            label="ARAÇLAR VE ANALİZ"
            isOpen={isOpen}
            onToggle={onToggle}
            isActive={activeMode !== MeasurementMode.NONE}
            performanceMode={performanceMode}
        >
            <div className="space-y-4">
                {['Temel', 'Analiz'].map(category => (
                    <div key={category} className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">
                            {category} ARAÇLARI
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {tools.filter(t => t.category === category).map((tool) => {
                                const isActive = activeMode === tool.mode;
                                return (
                                    <button
                                        key={tool.mode}
                                        onClick={() => onSetMode(tool.mode)}
                                        style={{
                                            borderColor: isActive ? tool.color : '',
                                            backgroundColor: isActive ? `${tool.color}20` : '', // 20 hex = ~12% opacity
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${isActive
                                            ? 'text-white shadow-lg'
                                            : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        <span style={{ color: isActive ? tool.color : '' }} className="transition-colors">
                                            {tool.icon}
                                        </span>
                                        <span className="text-[11px] font-bold uppercase tracking-tight">{tool.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {activeMode !== MeasurementMode.NONE && (
                <>
                    <div className="h-px bg-white/10 my-4" />
                </>
            )}
        </ToolbarItem>
    );
};
