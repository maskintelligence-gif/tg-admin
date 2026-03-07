import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import OneSignal from 'onesignal-cordova-plugin';

const ONESIGNAL_APP_ID = 'fce98616-7fa2-4eaa-a839-d57c4a83efa7';

export function useNotifications(
  onNotificationTap?: (data: Record<string, string>) => void
) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!onNotificationTap) return;

    try {
      // Initialize OneSignal
      OneSignal.initialize(ONESIGNAL_APP_ID);

      // Request permission
      OneSignal.Notifications.requestPermission(true);

      // Handle notification tap (background or killed)
      OneSignal.Notifications.addEventListener('click', (event) => {
        const data = event.notification.additionalData as Record<string, string>;
        if (data && onNotificationTap) {
          onNotificationTap(data);
        }
      });

    } catch (e) {
      console.error('OneSignal init error:', e);
    }

  }, [onNotificationTap]);
}
