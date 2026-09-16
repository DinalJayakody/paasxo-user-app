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
const BUFFER_KEY = '@paasxo:activityLocationBuffer';

export interface BufferedSample {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number | null;
  timestamp: number;
}

TaskManager.defineTask(ACTIVITY_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[activityLocationTask]', error.message);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations?.length) return;

  try {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    const existing: BufferedSample[] = raw ? JSON.parse(raw) : [];
    const additions: BufferedSample[] = locations.map((loc) => ({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude,
      speed: loc.coords.speed,
      timestamp: loc.timestamp,
    }));
    await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify([...existing, ...additions]));
  } catch (e) {
    console.warn('[activityLocationTask] failed to buffer sample:', e);
  }
});

/** Reads and clears every sample buffered since the last drain. */
export async function drainLocationBuffer(): Promise<BufferedSample[]> {
  try {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    if (!raw) return [];
    await AsyncStorage.removeItem(BUFFER_KEY);
    return JSON.parse(raw) as BufferedSample[];
  } catch {
    return [];
  }
}

export async function clearLocationBuffer(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BUFFER_KEY);
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
