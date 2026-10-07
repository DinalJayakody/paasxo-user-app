import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Registers this device directly with APNs (getDevicePushTokenAsync, not
 * getExpoPushTokenAsync) — the backend talks to Apple's push service itself
 * (see ApnsPushService.java), so there's no Expo/EAS relay and no EAS
 * projectId requirement.
 *
 * Shows the OS permission prompt on first call. Returns null (and never
 * throws) if permission is denied or this is a simulator, so callers never
 * need their own try/catch.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;

  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    const token = await Notifications.getDevicePushTokenAsync();
    return token.data;
  } catch (e) {
    console.warn('Push registration failed (non-fatal):', e);
    return null;
  }
}

/** Foreground presentation — without this, a push received while the app is
 *  open is silently swallowed instead of showing a banner/sound. Call once
 *  at app start (see app/_layout.tsx).
 *
 *  The live activity-tracking notification (see activityNotification.ts) is
 *  re-issued periodically while a Walk/Run/Cycling session is active and is
 *  explicitly data-tagged `{ type: 'activity-tracking' }` so it can be told
 *  apart here — it must NEVER present as a banner/alert or play a sound (it
 *  previously used the same rules as a real push, which meant it visibly
 *  popped up on screen every time it refreshed, including while the user was
 *  actively looking at the app). It should only ever be visible by pulling
 *  down the notification shade/center, same as any other silently-updating
 *  ongoing notification (e.g. a music player's). Every other notification
 *  (chat, match invites, real pushes) keeps the original banner+sound
 *  behavior unchanged. */
export function configurePushNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const isActivityTracking = notification.request.content.data?.type === 'activity-tracking';
      if (isActivityTracking) {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: true,
        };
      }
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
}
