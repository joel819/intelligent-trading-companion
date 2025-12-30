import { useEffect, useCallback } from 'react';

export const useNotifications = () => {
    useEffect(() => {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }, []);

    const showNotification = useCallback((title: string, options?: NotificationOptions) => {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            new Notification(title, options);
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    new Notification(title, options);
                }
            });
        }
    }, []);

    return { showNotification };
};
