import React, { useRef, useEffect } from 'react';
import { PerformanceMode } from '../../types';

interface Props {
    icon: React.ReactNode;
    label?: string;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    isActive?: boolean;
    className?: string;
    performanceMode?: PerformanceMode;
}

export const ToolbarItem: React.FC<Props> = ({
    icon,
    label,
    children,
    isOpen,
    onToggle,
    isActive,
    className = '',
    performanceMode
}) => {
    const ref = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && ref.current && !ref.current.contains(event.target as Node)) {
                onToggle();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen, onToggle]);

    return (
        <div className={`relative pointer-events-auto ${className}`} ref={ref}>
            {/* Panel (Fixed position to align all panels to the same spot) */}
            {isOpen && (
                <div className={`
                    fixed bottom-[120px] right-4 z-40 border border-white/20 rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] p-6 min-w-[320px] max-w-[90vw] animate-in slide-in-from-bottom-4 origin-bottom-right overflow-hidden
                    ${performanceMode === PerformanceMode.BATTERY_SAVER ? 'bg-black' : 'bg-[#0a0a0a]/90 backdrop-blur-3xl'}
                `}>
                    {label && (
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-bold text-white flex items-center gap-3 text-sm uppercase tracking-widest">
                                <span className="text-orange-500">{icon}</span>
                                {label}
                            </h3>
                        </div>
                    )}
                    {/* The children prop is where the contents would be rendered */}
                    {children}
                </div>
            )}

            {/* Button */}
            <button
                onClick={onToggle}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 border-2
          ${isActive || isOpen
                        ? 'bg-orange-500 border-white/40 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                        : 'bg-black border-white/20 text-gray-400 hover:text-white hover:border-white/40'
                    }
        `}
                title={label}
                aria-expanded={isOpen}
            >
                {icon}
            </button>
        </div>
    );
};
