/**
 * The persistent, periodically-updated notification shown while an activity
 * is being tracked — the lock-screen/notification-bar live display. This is
 * a standard local notification re-issued under the same `identifier`
 * (which Expo/the OS updates in place rather than stacking a new one each
 * time), NOT a native iOS Live Activity/Dynamic Island widget — that would
 * need a separate native Widget Extension project, scoped as a later
 * fast-follow rather than attempted here. See useActivityTracking.ts for
 * where this gets called.
 *
 * Also carries Pause/Resume/Stop action buttons (via a notification
 * "category") so the activity can be controlled without unlocking the
 * phone — app/_layout.tsx's response listener routes a tap on one of these
 * through activityControlBus.ts. Pause/Resume are configured to NOT bring
 * the app to the foreground (a quick toggle shouldn't yank the user out of
 * whatever else they're doing); Stop intentionally DOES, since it needs to
 * show the same "are you sure" confirmation the in-app Stop button already
 * does — a confirmation dialog is useless if the app isn't in front to show it.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Exported so app/_layout.tsx's global notification-tap listener can tell
// this notification apart from a push notification and route to the active
// activity screen instead of the default /notifications feed.
export const ACTIVITY_NOTIFICATION_ID = 'paasxo-active-activity';
const CHANNEL_ID = 'activity-tracking';

// Two categories (rather than one with all three actions) so the notification
// never shows both "Pause" and "Resume" at once — only whichever is valid for
// the current phase, picked by showActivityNotification's `paused` param.
export const ACTIVITY_CATEGORY_ACTIVE = 'activity-tracking-active';
export const ACTIVITY_CATEGORY_PAUSED = 'activity-tracking-paused';
export const ACTIVITY_ACTION_PAUSE = 'PAUSE';
export const ACTIVITY_ACTION_RESUME = 'RESUME';
export const ACTIVITY_ACTION_STOP = 'STOP';

let channelReady = false;
let categoriesReady = false;

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

async function ensureCategories(): Promise<void> {
  if (categoriesReady) return;
  try {
    await Notifications.setNotificationCategoryAsync(ACTIVITY_CATEGORY_ACTIVE, [
      { identifier: ACTIVITY_ACTION_PAUSE, buttonTitle: 'Pause', options: { opensAppToForeground: false } },
      { identifier: ACTIVITY_ACTION_STOP, buttonTitle: 'Stop', options: { isDestructive: true, opensAppToForeground: true } },
    ]);
    await Notifications.setNotificationCategoryAsync(ACTIVITY_CATEGORY_PAUSED, [
      { identifier: ACTIVITY_ACTION_RESUME, buttonTitle: 'Resume', options: { opensAppToForeground: false } },
      { identifier: ACTIVITY_ACTION_STOP, buttonTitle: 'Stop', options: { isDestructive: true, opensAppToForeground: true } },
    ]);
    categoriesReady = true;
  } catch (e) {
    console.warn('[activityNotification] failed to register categories:', e);
  }
}

export async function showActivityNotification(title: string, body: string, paused: boolean): Promise<void> {
  try {
    await ensureChannel();
    await ensureCategories();
    await Notifications.scheduleNotificationAsync({
      identifier: ACTIVITY_NOTIFICATION_ID,
      content: {
        title,
        body,
        sound: false,
        // Lets app/_layout.tsx's tap listener recognize this one without
        // string-matching the identifier a second time.
        data: { type: 'activity-tracking' },
        categoryIdentifier: paused ? ACTIVITY_CATEGORY_PAUSED : ACTIVITY_CATEGORY_ACTIVE,
        // Android: not swipe-dismissable while a session is genuinely
        // running — the user should stop tracking from the Stop button/
        // action, not accidentally lose the live card with a stray swipe.
        sticky: true,
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
    await Notifications.dismissNotificationAsync(ACTIVITY_NOTIFICATION_ID);
  } catch {
    // Nothing to dismiss / already gone — fine either way.
  }
}
