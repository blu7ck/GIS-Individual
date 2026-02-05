import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type NotificationType = 'info' | 'success' | 'error' | 'warning';

export interface NotificationItem {
    id: string;
    message: string;
    type: NotificationType;
}

const DEFAULT_DURATION_MS = 5000;

/**
 * Hook for managing toast notifications
 */
export const useNotifications = (defaultDuration: number = DEFAULT_DURATION_MS) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

    const dismiss = useCallback((id: string) => {
        const timeout = timeoutRefs.current.get(id);
        if (timeout) {
            clearTimeout(timeout);
            timeoutRefs.current.delete(id);
        }
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const notify = useCallback((message: string, type: NotificationType = 'info') => {
        const id = uuidv4();
        const notification: NotificationItem = { id, message, type };
        setNotifications(prev => [...prev, notification]);

        const timeout = setTimeout(() => dismiss(id), defaultDuration);
        timeoutRefs.current.set(id, timeout);
    }, [dismiss, defaultDuration]);

    const clearAll = useCallback(() => {
        timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
        timeoutRefs.current.clear();
        setNotifications([]);
    }, []);

    return { notifications, notify, dismiss, clearAll };
};

export default useNotifications;
