/**
 * Routes a tap on the activity-tracking notification's Pause/Resume/Stop
 * action button (see activityNotification.ts's categories) to whichever
 * useActivityTracking instance is actually live. app/_layout.tsx's global
 * notification-response listener is the only place that can receive these
 * taps (they can land while no activity screen is mounted at all), so it
 * can't call the hook directly — this is the thin bridge between the two.
 *
 * Pause/Resume are configured to NOT bring the app to the foreground (see
 * ACTIVITY_NOTIFICATION_CATEGORY_*), so they're applied silently if a
 * listener is already subscribed; if the tracker screen isn't mounted yet
 * (cold launch), the action is persisted and replayed once it mounts and
 * calls consumePendingActivityControl.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ActivityControlAction = 'PAUSE' | 'RESUME' | 'STOP';

const PENDING_KEY = '@paasxo:activityPendingControlAction';

let listeners: Array<(action: ActivityControlAction) => void> = [];

export function subscribeActivityControl(fn: (action: ActivityControlAction) => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export async function dispatchActivityControl(action: ActivityControlAction): Promise<void> {
  if (listeners.length > 0) {
    listeners.forEach((l) => l(action));
    return;
  }
  try {
    await AsyncStorage.setItem(PENDING_KEY, action);
  } catch {
    // Worst case the tap is lost — no live listener and nowhere to persist
    // it, which is no worse than a tap on a dismissed notification.
  }
}

/** Call once on mount (and again whenever a new tracking session actually
 * starts) to pick up an action that arrived while nothing was subscribed. */
export async function consumePendingActivityControl(): Promise<ActivityControlAction | null> {
  try {
    const value = await AsyncStorage.getItem(PENDING_KEY);
    if (value) await AsyncStorage.removeItem(PENDING_KEY);
    return value as ActivityControlAction | null;
  } catch {
    return null;
  }
}
