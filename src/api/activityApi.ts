import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from './axios';
import { LiveSplit } from '../utils/activityMath';

export type ActivityType = 'WALK' | 'RUN' | 'CYCLING';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speedKmh?: number;
  altitudeMeters?: number;
}

export interface StoredActivity {
  localId: string;
  serverId?: string;
  type: ActivityType;
  title: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  distanceMeters: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  // Null for CYCLING — pace isn't a meaningful metric there (speed is shown instead).
  avgPaceSecPerKm: number | null;
  elevationGainMeters: number;
  elevationLossMeters: number;
  // Null when the device's pedometer was unavailable/denied for this session.
  stepCount: number | null;
  // Null unless the user had a weight on file when this was recorded — see
  // activityMath.ts's calcCalories. Never fabricated from duration alone.
  calories: number | null;
  // Personal-best inputs for this activity — see activityMath.ts's
  // bestSplitPaceSecPerKm/bestSplitSpeedKmh/fastest400mSeconds.
  bestSplitPaceSecPerKm: number | null;
  bestSplitSpeedKmh: number | null;
  best400mSeconds: number | null;
  splits: LiveSplit[];
  routeCoordinates: RoutePoint[];
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number;
  endLongitude?: number;
}

// Present only when the activity belongs to someone other than the current
// user (a friend's shared activity, viewed via getById or getUserSummary) —
// undefined on your own activities.
export interface ActivityWithAuthor extends StoredActivity {
  authorDisplayName?: string;
  authorProfileImageUrl?: string;
}

export interface ActivityPersonalBests {
  activityCount: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  fastestSplitPaceSecPerKm: number | null;
  fastestSplitSpeedKmh: number | null;
  fastest400mSeconds: number | null;
  longestDistanceMeters: number;
  longestDurationSeconds: number;
}

export interface ActivityPeriodProgress {
  activityCount: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

export interface ActivitySummary {
  userId: string;
  displayName: string;
  profileImageUrl: string | null;
  // Keyed by ActivityType ('WALK' | 'RUN' | 'CYCLING') — absent for a type
  // the user has never recorded.
  bests: Partial<Record<ActivityType, ActivityPersonalBests>>;
  recentActivities: ActivityWithAuthor[];
  // Rolling last-7-days / last-30-days totals, all types combined.
  weeklyProgress: ActivityPeriodProgress;
  monthlyProgress: ActivityPeriodProgress;
}

function fromActivityResponse(d: any): ActivityWithAuthor {
  return {
    localId: d.id ?? d.localId,
    serverId: d.id,
    type: d.type === 'CYCLE' ? 'CYCLING' : d.type,
    title: d.title,
    startTime: d.startTime,
    endTime: d.endTime,
    durationSeconds: d.durationSeconds,
    distanceMeters: d.distanceMeters,
    avgSpeedKmh: d.avgSpeedKmh,
    maxSpeedKmh: d.maxSpeedKmh,
    avgPaceSecPerKm: d.avgPaceSecPerKm ?? null,
    elevationGainMeters: d.elevationGainMeters,
    elevationLossMeters: d.elevationLossMeters ?? 0,
    stepCount: d.stepCount ?? null,
    calories: d.calories ?? null,
    bestSplitPaceSecPerKm: d.bestSplitPaceSecPerKm ?? null,
    bestSplitSpeedKmh: d.bestSplitSpeedKmh ?? null,
    best400mSeconds: d.best400mSeconds ?? null,
    splits: (d.splits ?? []).map((s: any) => ({
      index: s.index,
      durationSeconds: s.durationSeconds,
      paceSecPerKm: s.paceSecPerKm ?? null,
      avgSpeedKmh: s.avgSpeedKmh,
    })),
    routeCoordinates: (d.route ?? d.routeCoordinates ?? []).map((p: any) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      timestamp: p.timestampMillis ?? p.timestamp,
      speedKmh: p.speedKmh ?? undefined,
      altitudeMeters: p.altitudeMeters ?? undefined,
    })),
    startLatitude: d.startLatitude,
    startLongitude: d.startLongitude,
    endLatitude: d.endLatitude,
    endLongitude: d.endLongitude,
    authorDisplayName: d.authorDisplayName ?? undefined,
    authorProfileImageUrl: d.authorProfileImageUrl ?? undefined,
  };
}

/**
 * Public link shared externally (WhatsApp/etc) and baked into the share card
 * image (see ActivityShareCard) — opens app/activity/[id].tsx, which the
 * existing Expo web export (see vercel.json) already serves at this same
 * path on the web build, so the link works as a browser fallback even
 * without the app installed.
 *
 * ASSUMES www.paasxo.com is where that web build is actually deployed —
 * it's the one domain confirmed elsewhere in this codebase (see
 * endpoints.ts's HOSTINGER_URL), but nginx.conf (mobile-app-paasxo repo)
 * only proxies /api/ on this domain today, nothing routes "/" to the web
 * app yet. Update this constant if the real web deployment is at a
 * different host, and see this app's own deployment docs for wiring one up
 * if it isn't already. For the link to open the APP directly (not just a
 * mobile browser) when tapped, iOS Universal Links / Android App Links also
 * need to be configured (associated domains entitlement + a hosted
 * apple-app-site-association / assetlinks.json) — not set up by this change.
 */
const WEB_APP_BASE_URL = 'https://www.paasxo.com';
export function activityShareUrl(serverId: string): string {
  return `${WEB_APP_BASE_URL}/activity/${serverId}`;
}

const STORAGE_KEY = '@paasxo:activities';

export const activityStorage = {
  async getAll(): Promise<StoredActivity[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as StoredActivity[];
    } catch {
      return [];
    }
  },

  /**
   * Upserts by localId — replaces an existing entry in place (preserving its
   * position) rather than always prepending a new one. This matters for any
   * caller that re-saves an already-saved activity to patch a field (e.g.
   * ActivityDetailScreen's ensureServerId attaching a serverId once a
   * previously-offline activity finally syncs) — prepending unconditionally
   * would leave two entries with the same localId in storage, which then
   * both surface as separate cards in ActivityHistoryScreen (its
   * local+remote merge dedupes across sources by localId, but never within
   * the local list itself).
   */
  async save(activity: StoredActivity): Promise<void> {
    try {
      const existing = await activityStorage.getAll();
      const index = existing.findIndex((a) => a.localId === activity.localId);
      const updated = index >= 0
        ? existing.map((a, i) => (i === index ? activity : a))
        : [activity, ...existing];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  },

  async delete(localId: string): Promise<void> {
    try {
      const existing = await activityStorage.getAll();
      const updated = existing.filter((a) => a.localId !== localId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  },

  async getById(localId: string): Promise<StoredActivity | null> {
    const all = await activityStorage.getAll();
    return all.find((a) => a.localId === localId) ?? null;
  },
};

export const activityApi = {
  async syncToServer(activity: StoredActivity): Promise<string | null> {
    try {
      const { data } = await axiosInstance.post('/activities', {
        type: activity.type === 'CYCLING' ? 'CYCLE' : activity.type,
        title: activity.title,
        startTime: activity.startTime,
        endTime: activity.endTime,
        durationSeconds: activity.durationSeconds,
        distanceMeters: activity.distanceMeters,
        avgSpeedKmh: activity.avgSpeedKmh,
        maxSpeedKmh: activity.maxSpeedKmh,
        avgPaceSecPerKm: activity.avgPaceSecPerKm,
        elevationGainMeters: activity.elevationGainMeters,
        elevationLossMeters: activity.elevationLossMeters,
        stepCount: activity.stepCount,
        calories: activity.calories,
        bestSplitPaceSecPerKm: activity.bestSplitPaceSecPerKm,
        bestSplitSpeedKmh: activity.bestSplitSpeedKmh,
        best400mSeconds: activity.best400mSeconds,
        startLatitude: activity.startLatitude,
        startLongitude: activity.startLongitude,
        endLatitude: activity.endLatitude,
        endLongitude: activity.endLongitude,
        route: activity.routeCoordinates.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          altitudeMeters: p.altitudeMeters ?? null,
          timestampMillis: p.timestamp,
          speedKmh: p.speedKmh ?? null,
        })),
        splits: activity.splits.map((s) => ({
          index: s.index,
          durationSeconds: s.durationSeconds,
          paceSecPerKm: s.paceSecPerKm,
          avgSpeedKmh: s.avgSpeedKmh,
        })),
      });
      return data?.id ?? null;
    } catch {
      return null;
    }
  },

  async getMyActivities(): Promise<StoredActivity[]> {
    try {
      const { data } = await axiosInstance.get('/activities/my');
      const items: any[] = Array.isArray(data) ? data : (data?.content ?? []);
      return items.map(fromActivityResponse);
    } catch {
      return [];
    }
  },

  /**
   * Not ownership-restricted server-side — also resolves a friend's shared
   * activity (e.g. opened via a paasxo.com/activity/{id} link), gated by the
   * backend's own follow/private-account check. Returns null both when the
   * activity doesn't exist and when the viewer isn't allowed to see it
   * (same as the backend, which doesn't distinguish the two either).
   */
  async getById(serverId: string): Promise<ActivityWithAuthor | null> {
    try {
      const { data } = await axiosInstance.get(`/activities/${serverId}`);
      return fromActivityResponse(data);
    } catch {
      return null;
    }
  },

  /** Powers a profile's Stats tab — own or a friend's. See ActivitySummary. */
  async getUserSummary(firebaseUid: string): Promise<ActivitySummary | null> {
    try {
      const { data } = await axiosInstance.get(`/activities/user/${firebaseUid}/summary`);
      return {
        userId: data.userId,
        displayName: data.displayName,
        profileImageUrl: data.profileImageUrl ?? null,
        bests: data.bests ?? {},
        recentActivities: (data.recentActivities ?? []).map(fromActivityResponse),
        weeklyProgress: data.weeklyProgress ?? { activityCount: 0, totalDistanceMeters: 0, totalDurationSeconds: 0 },
        monthlyProgress: data.monthlyProgress ?? { activityCount: 0, totalDistanceMeters: 0, totalDurationSeconds: 0 },
      };
    } catch {
      return null;
    }
  },

  async deleteFromServer(serverId: string): Promise<void> {
    try {
      await axiosInstance.delete(`/activities/${serverId}`);
    } catch {}
  },
};
