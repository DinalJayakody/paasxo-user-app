/**
 * The persistent, periodically-updated notification shown while an activity
 * is being tracked — the lock-screen/notification-bar live display. This is
 * a standard local notification re-issued under the same `identifier`
 * (which Expo/the OS updates in place rather than stacking a new one each
 * time), NOT a native iOS Live Activity/Dynamic Island widget — that would
 * need a separate native Widget Extension project, scoped as a later
 * fast-follow rather than attempted here. See useActivityTracking.ts for
 * where this gets called.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const NOTIFICATION_ID = 'paasxo-active-activity';
const CHANNEL_ID = 'activity-tracking';

let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  try {
    // LOW importance + no sound: this updates every few seconds while
    // tracking, so it must sit silently in the shade rather than
    // buzzing/chiming on every refresh.
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Activity Tracking',
      importance: Notifications.AndroidImportance.LOW,
      sound: undefined,
      vibrationPattern: undefined,
    });
    channelReady = true;
  } catch (e) {
    console.warn('[activityNotification] failed to create channel:', e);
  }
}

export async function showActivityNotification(title: string, body: string): Promise<void> {
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title,
        body,
        sound: false,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[activityNotification] failed to update:', e);
  }
}

export async function dismissActivityNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch {
    // Nothing to dismiss / already gone — fine either way.
  }
}
