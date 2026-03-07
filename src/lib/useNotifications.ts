import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// OneSignal App ID
const ONESIGNAL_APP_ID = 'fce98616-7fa2-4eaa-a839-d57c4a83efa7';

/**
 * Initializes OneSignal push notifications.
 * Only runs on native Android/iOS.
 * @param onNotificationTap - called when user taps a notification
 */
export function useNotifications(
  onNotificationTap?: (data: Record<string, string>) => void
) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!onNotificationTap) return;

    const setup = async () => {
      try {
        // Dynamically import to avoid browser errors
        const { OneSignal } = await import('onesignal-cordova-plugin');

        // Initialize with your app ID
        OneSignal.initialize(ONESIGNAL_APP_ID);

        // Request permission prompt
        OneSignal.Notifications.requestPermission(true);

        // Handle tap when app is background or killed
        OneSignal.Notifications.addEventListener('click', (event) => {
          const data = event.notification.additionalData as Record<string, string>;
          if (data && onNotificationTap) {
            onNotificationTap(data);
          }
        });

      } catch (e) {
        console.error('OneSignal init error:', e);
      }
    };

    const timer = setTimeout(setup, 1000);
    return () => clearTimeout(timer);

  }, [onNotificationTap]);
}
