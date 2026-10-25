/**
 * Background GPS delivery for activity tracking. `TaskManager.defineTask`
 * MUST be called at module scope (not inside a component/hook) so Expo can
 * re-attach it after the JS engine is torn down and recreated while the app
 * is backgrounded — this module is imported once, early, from app/_layout.tsx
 * for exactly that reason (see the import there).
 *
 * Deliberately the ONLY channel activity tracking reads location from — see
 * useActivityTracking.ts. `Location.startLocationUpdatesAsync` keeps
 * delivering through this same task whether the app is foregrounded or
 * backgrounded, so the hook just drains this buffer on an interval instead
 * of also running a separate `watchPositionAsync` subscription, which would
 * double-count distance from two parallel streams.
 */
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACTIVITY_LOCATION_TASK = 'paasxo-activity-location-task';
const BUFFER_KEY = '@paasxo:activityLocationBuffer'; // legacy single-array buffer
const BATCH_PREFIX = '@paasxo:activityLoc:';

export interface BufferedSample {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
  // Horizontal accuracy in meters (smaller = better) — used to reject
  // low-quality fixes before they pollute distance/speed, see
  // useActivityTracking.ts's MAX_SAMPLE_ACCURACY_M.
  accuracy: number | null;
  // Vertical accuracy in metres — noisy GPS altitude is skipped for elevation.
  altitudeAccuracy?: number | null;
}

TaskManager.defineTask(ACTIVITY_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[activityLocationTask]', error.message);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations?.length) return;

  try {
    const additions: BufferedSample[] = locations.map((loc) => ({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude,
      speed: loc.coords.speed,
      timestamp: loc.timestamp,
      accuracy: loc.coords.accuracy,
      altitudeAccuracy: loc.coords.altitudeAccuracy,
    }));
    // One key per delivered batch (never read-modify-write a shared array):
    // a drain running at the same moment can't erase a batch it never read.
    const key = `${BATCH_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await AsyncStorage.setItem(key, JSON.stringify(additions));
  } catch (e) {
    console.warn('[activityLocationTask] failed to buffer sample:', e);
  }
});

async function batchKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((k) => k.startsWith(BATCH_PREFIX));
}

/** Reads and removes exactly the batches buffered so far (plus any legacy single-array buffer). */
export async function drainLocationBuffer(): Promise<BufferedSample[]> {
  try {
    const keys = await batchKeys();
    const out: BufferedSample[] = [];
    if (keys.length) {
      const entries = await AsyncStorage.multiGet(keys);
      for (const [, raw] of entries) {
        if (!raw) continue;
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) out.push(...arr);
        } catch {
          // corrupt batch — skip it
        }
      }
      await AsyncStorage.multiRemove(keys);
    }
    const legacy = await AsyncStorage.getItem(BUFFER_KEY);
    if (legacy) {
      await AsyncStorage.removeItem(BUFFER_KEY);
      try { out.push(...JSON.parse(legacy)); } catch { /* ignore */ }
    }
    return out;
  } catch {
    return [];
  }
}

export async function clearLocationBuffer(): Promise<void> {
  try {
    const keys = await batchKeys();
    await AsyncStorage.multiRemove([...keys, BUFFER_KEY]);
  } catch {
    // Non-fatal — a stale buffer just gets picked up (and safely ignored,
    // since the hook resets its own accumulators) on the next session.
  }
}

export async function isActivityLocationTaskRunning(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(ACTIVITY_LOCATION_TASK);
  } catch {
    return false;
  }
}
