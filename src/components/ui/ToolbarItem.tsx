import React, { useRef, useEffect } from 'react';

interface Props {
    icon: React.ReactNode;
    label?: string;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    isActive?: boolean;
    className?: string;
}

export const ToolbarItem: React.FC<Props> = ({
    icon,
    label,
    children,
    isOpen,
    onToggle,
    isActive,
    className = ''
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
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onToggle]);

    return (
        <div className={`relative pointer-events-auto ${className}`} ref={ref}>
            {/* Panel (Fixed position to align all panels to the same spot) */}
            {isOpen && (
                <div className="fixed bottom-[120px] right-4 z-40 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl p-4 min-w-[280px] max-w-[90vw] animate-in slide-in-from-bottom-2 origin-bottom-right overflow-hidden">
                    {label && (
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-tight">
                                <span className="text-gray-400">{icon}</span>
                                {label}
                            </h3>
                        </div>
                    )}
                    {/* The children prop is where the MeasurementTool's buttons would be rendered */}
                    {children}
                </div>
            )}

            {/* Button */}
            <button
                onClick={onToggle}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 border
          ${isActive || isOpen
                        ? 'bg-white/20 text-white border-white/30 shadow-white/10'
                        : 'bg-black/60 backdrop-blur-xl text-gray-400 border-white/10 hover:text-white hover:border-white/30'
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
