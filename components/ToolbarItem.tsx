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
                <div className="fixed bottom-20 right-4 md:bottom-20 md:right-4 z-40 bg-[#1C1B19]/95 backdrop-blur-xl border border-[#57544F] rounded-xl shadow-2xl p-4 min-w-[280px] max-w-[90vw] animate-in slide-in-from-bottom-2 origin-bottom-right">
                    {label && (
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                                {icon}
                                {label}
                            </h3>
                        </div>
                    )}
                    {children}
                </div>
            )}

            {/* Button */}
            <button
                onClick={onToggle}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 border
          ${isActive || isOpen
                        ? 'bg-[#12B285] text-white border-[#12B285]'
                        : 'bg-[#1C1B19]/90 text-[#57544F] border-[#57544F] hover:text-white hover:border-[#12B285] hover:bg-[#1C1B19]'
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
