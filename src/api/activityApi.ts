import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from './axios';

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
  estimatedCalories: number;
  elevationGainMeters: number;
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
        type: activity.type,
        title: activity.title,
        startTime: activity.startTime,
        endTime: activity.endTime,
        durationSeconds: activity.durationSeconds,
        distanceMeters: activity.distanceMeters,
        avgSpeedKmh: activity.avgSpeedKmh,
        maxSpeedKmh: activity.maxSpeedKmh,
        estimatedCalories: activity.estimatedCalories,
        elevationGainMeters: activity.elevationGainMeters,
        startLatitude: activity.startLatitude,
        startLongitude: activity.startLongitude,
        endLatitude: activity.endLatitude,
        endLongitude: activity.endLongitude,
        routeCoordinates: activity.routeCoordinates,
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
        type: d.type,
        title: d.title,
        startTime: d.startTime,
        endTime: d.endTime,
        durationSeconds: d.durationSeconds,
        distanceMeters: d.distanceMeters,
        avgSpeedKmh: d.avgSpeedKmh,
        maxSpeedKmh: d.maxSpeedKmh,
        estimatedCalories: d.estimatedCalories,
        elevationGainMeters: d.elevationGainMeters,
        routeCoordinates: d.routeCoordinates ?? [],
        startLatitude: d.startLatitude,
        startLongitude: d.startLongitude,
        endLatitude: d.endLatitude,
        endLongitude: d.endLongitude,
      }));
    } catch {
      return [];
    }
  },
};
