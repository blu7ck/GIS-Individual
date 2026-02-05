/**
 * AssetItem - Generic reusable component for layer items
 * Handles KML, 3D Tiles, DXF, SHP, GLB layer types
 */
import React, { memo } from 'react';
import { Eye, EyeOff, Share2, Trash2, Edit2, Check, X as XIcon } from 'lucide-react';
import { AssetLayer, LayerType } from '../../types';
import { getLayerTypeStyle } from './layerTypeConfig';

export interface AssetItemProps {
    asset: AssetLayer;
    isEditing: boolean;
    editingName: string;
    onLayerClick?: (id: string) => void;
    onToggle: (id: string) => void;
    onShare: (asset: AssetLayer) => void;
    onDelete: (id: string) => void;
    onEditStart: (asset: AssetLayer) => void;
    onEditChange: (name: string) => void;
    onEditSave: () => void;
    onEditCancel: () => void;
    onOpenModelViewer?: (asset: AssetLayer) => void;
    showEditButton?: boolean;
    showShareButton?: boolean;
}

export const AssetItem = memo<AssetItemProps>(({
    asset,
    isEditing,
    editingName,
    onLayerClick,
    onToggle,
    onShare,
    onDelete,
    onEditStart,
    onEditChange,
    onEditSave,
    onEditCancel,
    onOpenModelViewer,
    showEditButton = false,
    showShareButton = true,
}) => {
    const { icon: Icon, color, hoverColor } = getLayerTypeStyle(asset.type);
    const isGLB = asset.type === LayerType.GLB_UNCOORD;

    const handleClick = () => {
        if (isGLB && onOpenModelViewer) {
            onOpenModelViewer(asset);
        } else if (onLayerClick) {
            onLayerClick(asset.id);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
    };

    return (
        <div className="group flex items-center justify-between p-1.5 rounded hover:bg-[#57544F]/20 transition">
            <div className="flex items-center overflow-hidden flex-1">
                <Icon size={14} className={`${color} mr-2 flex-shrink-0`} />
                {isEditing ? (
                    <input
                        type="text"
                        value={editingName}
                        onChange={(e) => onEditChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onEditSave();
                            if (e.key === 'Escape') onEditCancel();
                        }}
                        className="flex-1 bg-[#1C1B19] border border-[#12B285]/50 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#12B285]/50"
                        autoFocus
                    />
                ) : (
                    <span
                        className={`text-xs truncate flex-1 text-carta-mist-300 cursor-pointer ${hoverColor} transition-colors`}
                        title={asset.name}
                        onClick={handleClick}
                        onTouchEnd={handleTouchEnd}
                    >
                        {asset.name}
                    </span>
                )}
            </div>
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                {isEditing ? (
                    <>
                        <button onClick={onEditSave} className="text-carta-mist-500 hover:text-carta-forest-400" title="Save">
                            <Check size={12} />
                        </button>
                        <button onClick={onEditCancel} className="text-carta-mist-500 hover:text-carta-accent-red" title="Cancel">
                            <XIcon size={12} />
                        </button>
                    </>
                ) : (
                    <>
                        {!isGLB && (
                            <button onClick={() => onToggle(asset.id)} className="text-carta-mist-500 hover:text-white" title="Toggle Visibility">
                                {asset.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                        )}
                        {isGLB && onOpenModelViewer && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenModelViewer(asset);
                                }}
                                className="text-carta-mist-500 hover:text-purple-400"
                                title="View 3D Model"
                            >
                                <Icon size={12} />
                            </button>
                        )}
                        {showShareButton && !isGLB && (
                            <button onClick={() => onShare(asset)} className="text-carta-mist-500 hover:text-carta-forest-400" title="Share Layer">
                                <Share2 size={12} />
                            </button>
                        )}
                        {showEditButton && (
                            <button onClick={() => onEditStart(asset)} className="text-carta-mist-500 hover:text-carta-gold-400" title="Edit Name">
                                <Edit2 size={12} />
                            </button>
                        )}
                        <button onClick={() => onDelete(asset.id)} className="text-carta-mist-500 hover:text-carta-accent-red" title="Delete">
                            <Trash2 size={12} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
});

AssetItem.displayName = 'AssetItem';
