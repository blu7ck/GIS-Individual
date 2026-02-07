import { useState, useCallback } from 'react';

import { NotificationType } from '../components/common/Notification';

export interface User {
    email: string;
    id: string;
}

export function useAppAuth(notify: (message: string, type: NotificationType) => void) {
    const [user, setUser] = useState<User | null>(null);

    const handleLogin = useCallback((email: string, userId: string) => {
        setUser({ email, id: userId });
        notify(`Welcome back, ${email}`, 'success');
    }, [notify]);

    return {
        user,
        setUser,
        handleLogin
    };
}
