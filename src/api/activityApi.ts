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

// No calorie field — there's no legitimate per-user calculation in place
// (would need real body weight + pace-varying MET, neither of which exist),
// so the feature was removed rather than shipped with a fabricated number.
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
  splits: LiveSplit[];
  routeCoordinates: RoutePoint[];
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number;
  endLongitude?: number;
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

  async save(activity: StoredActivity): Promise<void> {
    try {
      const existing = await activityStorage.getAll();
      const updated = [activity, ...existing];
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
      return items.map((d: any) => ({
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
      }));
    } catch {
      return [];
    }
  },

  async deleteFromServer(serverId: string): Promise<void> {
    try {
      await axiosInstance.delete(`/activities/${serverId}`);
    } catch {}
  },
};
