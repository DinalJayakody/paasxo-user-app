/**
 * Periodic checkpoint of an in-progress activity-tracking session, so it can
 * be recovered if the app is killed (not just backgrounded) mid-session —
 * distinct from activityLocationTask.ts's raw GPS sample buffer, which only
 * ever holds the last few undrained seconds and is not enough on its own to
 * reconstruct a session's accumulated distance/elevation/splits after a kill.
 * Written by useActivityTracking.ts on start/pause and periodically while
 * ACTIVE; read once at ActivityTrackerScreen mount to offer a Resume prompt;
 * cleared on a normal finish or an explicit discard.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityType, RoutePoint } from '../api/activityApi';
import { LiveSplit } from '../utils/activityMath';

const SESSION_KEY = '@paasxo:activeTrackingSession';

export interface PersistedTrackingSession {
  activityType: ActivityType;
  startTime: string; // ISO — the ORIGINAL session start, never rewritten on resume
  phase: 'ACTIVE' | 'PAUSED';
  distanceMeters: number;
  maxSpeedKmh: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  route: RoutePoint[];
  splits: LiveSplit[];
  lastSplitDistanceM: number;
  lastSplitElapsedS: number;
  stepCount: number | null;
  lastProcessedTimestamp: number;
}

export async function saveTrackingSession(session: PersistedTrackingSession): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Best-effort — a failed checkpoint only costs some recency on the next
    // resume, never the whole session (the previous checkpoint, if any,
    // stays in place since this is a full overwrite that simply didn't land).
  }
}

export async function loadTrackingSession(): Promise<PersistedTrackingSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PersistedTrackingSession) : null;
  } catch {
    return null;
  }
}

export async function clearTrackingSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // Non-fatal — a stale checkpoint just gets offered as a resumable
    // session again next launch, and starting a fresh one below still works.
  }
}
