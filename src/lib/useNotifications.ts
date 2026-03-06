import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

// Your deployed notification server URL
const NOTIFICATION_SERVER_URL = import.meta.env.VITE_NOTIFICATION_SERVER_URL || '';
const WEBHOOK_SECRET = import.meta.env.VITE_WEBHOOK_SECRET || '';

/**
 * Registers the device for FCM push notifications.
 * Call this once after the user is logged in.
 *
 * @param onNotificationTap - called when user taps a notification, receives the data payload
 */
export function useNotifications(
  onNotificationTap?: (data: Record<string, string>) => void
) {
  useEffect(() => {
    // Only run on native Android/iOS — not in browser
    if (!Capacitor.isNativePlatform()) return;

    // If no callback passed, session not ready yet — skip
    if (onNotificationTap === undefined) return;

    // Small delay to let Capacitor fully initialize
    const timer = setTimeout(setup, 1000);

    async function setup() {
      // 1. Request permission
      let permission = await PushNotifications.checkPermissions();
      if (permission.receive === 'prompt') {
        permission = await PushNotifications.requestPermissions();
      }
      if (permission.receive !== 'granted') {
        console.warn('Push notification permission denied');
        return;
      }

      // 2. Register with FCM
      await PushNotifications.register();

      // 3. On successful registration — send token to our server
      PushNotifications.addListener('registration', async (token) => {
        console.log('FCM token:', token.value);
        try {
          await fetch(`${NOTIFICATION_SERVER_URL}/register-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secret: WEBHOOK_SECRET,
              token: token.value,
            }),
          });
        } catch (e) {
          console.error('Failed to register FCM token:', e);
        }
      });

      // 4. Registration error
      PushNotifications.addListener('registrationError', (err) => {
        console.error('FCM registration error:', err);
      });

      // 5. Notification received while app is OPEN — show it
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Notification received (foreground):', notification);
        // The notification banner shows automatically on Android
        // You could also show a custom in-app toast here
      });

      // 6. User TAPPED a notification (app was background or killed)
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data as Record<string, string>;
        console.log('Notification tapped, data:', data);
        if (onNotificationTap && data) {
          onNotificationTap(data);
        }
      });
    };

    // Cleanup listeners on unmount
    return () => {
      clearTimeout(timer);
      PushNotifications.removeAllListeners();
    };
  }, [onNotificationTap]);
}
