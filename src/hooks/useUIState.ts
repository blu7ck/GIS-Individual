import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { NotificationItem, NotificationType } from '../components/common/Notification';
import { AssetLayer } from '../types';

export type PopupType = 'none' | 'layers' | 'measurements' | 'upload' | 'settings';

export function useUIState() {
    // Routing / View Mode
    const [isViewerMode, setIsViewerMode] = useState(false);
    const [shareId, setShareId] = useState<string | null>(null);

    // Panels & Popups
    const [activePopup, setActivePopup] = useState<PopupType>('none');
    const [projectPanelOpen, setProjectPanelOpen] = useState(true);
    const [createProjectTrigger, setCreateProjectTrigger] = useState(0);
    const [showSettings, setShowSettings] = useState(false);
    const [activeModelLayer, setActiveModelLayer] = useState<AssetLayer | null>(null);
    const [positioningLayerId, setPositioningLayerId] = useState<string | null>(null);
    const [isPlacingOnMap, setIsPlacingOnMap] = useState<string | null>(null);

    // Notifications
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    // Initial Routing Check
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sid = params.get('share_id');
        if (sid) {
            setIsViewerMode(true);
            setShareId(sid);
        }
    }, []);

    // Responsive Sidebar Logic
    useEffect(() => {
        const checkMobile = () => window.innerWidth < 768;

        // Initial State
        if (checkMobile()) {
            setProjectPanelOpen(false);
        }

        let lastWidth = window.innerWidth;
        const handleResize = () => {
            const currentWidth = window.innerWidth;
            const wasMobile = lastWidth < 768;
            const isMobile = currentWidth < 768;

            if (wasMobile !== isMobile) {
                setProjectPanelOpen(!isMobile);
            }
            lastWidth = currentWidth;
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Notification Helper
    const notify = useCallback((message: string, type: NotificationType = 'info') => {
        const id = uuidv4();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);

    return {
        // State
        isViewerMode,
        shareId,
        activePopup,
        setActivePopup,
        projectPanelOpen,
        setProjectPanelOpen,
        createProjectTrigger,
        setCreateProjectTrigger,
        showSettings,
        setShowSettings,
        activeModelLayer,
        setActiveModelLayer,
        positioningLayerId,
        setPositioningLayerId,
        isPlacingOnMap,
        setIsPlacingOnMap,
        notifications,

        // Actions
        notify,
        dismissNotification: (id: string) => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }
    };
}
