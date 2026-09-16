/**
 * The stateful engine behind activity tracking: GPS (background-capable via
 * expo-task-manager), the live lock-screen/notification-bar display, step
 * counting, and the distance/pace/elevation/split computations from
 * activityMath.ts. ActivityTrackerScreen.tsx consumes this and owns only
 * the phase state machine / UI.
 *
 * Location flows through exactly ONE channel: `Location.startLocationUpdatesAsync`
 * delivers into the module-scope TaskManager task (activityLocationTask.ts),
 * which buffers samples to AsyncStorage regardless of foreground/background
 * state; this hook just drains that buffer on an interval. There is
 * deliberately no separate `watchPositionAsync` subscription running
 * alongside it — that would double-count distance from two parallel streams
 * feeding the same accumulator.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import {
  ACTIVITY_LOCATION_TASK, drainLocationBuffer, clearLocationBuffer, BufferedSample,
} from '../lib/activityLocationTask';
import { showActivityNotification, dismissActivityNotification } from '../lib/activityNotification';
import {
  haversineMeters, ElevationTracker, SplitTracker, LiveSplit, formatTime, formatDist, distUnit, calcPaceSecPerKm,
} from '../utils/activityMath';
import { ActivityType, RoutePoint } from '../api/activityApi';

const DRAIN_INTERVAL_MS = 2000;
const NOTIFICATION_UPDATE_INTERVAL_MS = 5000;
// Same GPS-noise sanity filter the previous implementation used: reject a
// sample-to-sample jump too small to be real movement or too large to be
// plausible (a GPS glitch), rather than folding either into distance.
const MIN_SAMPLE_DISTANCE_M = 1;
const MAX_SAMPLE_DISTANCE_M = 200;

export type TrackingPhase = 'IDLE' | 'ACTIVE' | 'PAUSED';

export interface TrackingStats {
  elapsedSeconds: number;
  distanceMeters: number;
  currentSpeedKmh: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  currentPaceSecPerKm: number | null;
  elevationGainMeters: number;
  elevationLossMeters: number;
  stepCount: number | null;
  splits: LiveSplit[];
  route: RoutePoint[];
  mapCoords: { latitude: number; longitude: number }[];
  currentLocation: { latitude: number; longitude: number } | null;
  backgroundPermissionGranted: boolean;
}

export interface FinishedActivityData {
  durationSeconds: number;
  distanceMeters: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  avgPaceSecPerKm: number | null;
  elevationGainMeters: number;
  elevationLossMeters: number;
  stepCount: number | null;
  route: RoutePoint[];
  splits: LiveSplit[];
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number;
  endLongitude?: number;
  startTime: Date;
  endTime: Date;
}

function emptyStats(): TrackingStats {
  return {
    elapsedSeconds: 0, distanceMeters: 0, currentSpeedKmh: 0, maxSpeedKmh: 0, avgSpeedKmh: 0,
    currentPaceSecPerKm: null, elevationGainMeters: 0, elevationLossMeters: 0, stepCount: null,
    splits: [], route: [], mapCoords: [], currentLocation: null, backgroundPermissionGranted: false,
  };
}

const locationTaskOptions: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 2000,
  distanceInterval: 3,
  pausesUpdatesAutomatically: false,
  // Android-only: this is what keeps delivery alive with the screen locked
  // AND is what shows the required persistent Android foreground-service
  // notification — expo-location's own documented mechanism, no native
  // code needed. iOS background delivery instead comes from the
  // `UIBackgroundModes: ["location"]` entry in app.json.
  foregroundService: {
    notificationTitle: 'PaasXO',
    notificationBody: 'Tracking your activity',
  },
  activityType: Location.ActivityType.Fitness,
};

export function useActivityTracking(activityType: ActivityType) {
  const [phase, setPhase] = useState<TrackingPhase>('IDLE');
  const [stats, setStats] = useState<TrackingStats>(emptyStats());

  const routeRef = useRef<RoutePoint[]>([]);
  const distanceRef = useRef(0);
  const maxSpeedRef = useRef(0);
  const elevationRef = useRef(new ElevationTracker());
  const splitTrackerRef = useRef(new SplitTracker(activityType !== 'CYCLING'));
  const startTimeRef = useRef<Date | null>(null);
  const elapsedRef = useRef(0);
  const lastProcessedTimestampRef = useRef(0);
  const stepCountRef = useRef<number | null>(null);
  const currentLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const drainIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pedometerSubRef = useRef<{ remove: () => void } | null>(null);

  const processSample = useCallback((sample: BufferedSample) => {
    // Dedupe + reject-out-of-order — background delivery can occasionally
    // redeliver or batch slightly out of sequence.
    if (sample.timestamp <= lastProcessedTimestampRef.current) return;
    lastProcessedTimestampRef.current = sample.timestamp;

    const prev = routeRef.current[routeRef.current.length - 1];
    if (prev) {
      const d = haversineMeters(prev.latitude, prev.longitude, sample.latitude, sample.longitude);
      if (d > MIN_SAMPLE_DISTANCE_M && d < MAX_SAMPLE_DISTANCE_M) {
        distanceRef.current += d;
      }
    }
    elevationRef.current.addSample(sample.altitude);

    const speedKmh = sample.speed != null && sample.speed >= 0 ? sample.speed * 3.6 : 0;
    if (speedKmh > maxSpeedRef.current) maxSpeedRef.current = speedKmh;

    const point: RoutePoint = {
      latitude: sample.latitude,
      longitude: sample.longitude,
      timestamp: sample.timestamp,
      speedKmh,
      altitudeMeters: sample.altitude ?? undefined,
    };
    routeRef.current = [...routeRef.current, point];
    currentLocationRef.current = { latitude: sample.latitude, longitude: sample.longitude };

    const newSplit = splitTrackerRef.current.update(distanceRef.current, elapsedRef.current);

    setStats((s) => ({
      ...s,
      distanceMeters: distanceRef.current,
      currentSpeedKmh: parseFloat(speedKmh.toFixed(1)),
      maxSpeedKmh: parseFloat(maxSpeedRef.current.toFixed(1)),
      avgSpeedKmh: elapsedRef.current > 0
        ? parseFloat(((distanceRef.current / 1000) / (elapsedRef.current / 3600)).toFixed(1))
        : 0,
      currentPaceSecPerKm: calcPaceSecPerKm(distanceRef.current, elapsedRef.current),
      elevationGainMeters: Math.round(elevationRef.current.gainMeters),
      elevationLossMeters: Math.round(elevationRef.current.lossMeters),
      route: routeRef.current,
      mapCoords: routeRef.current.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      currentLocation: currentLocationRef.current,
      splits: newSplit ? splitTrackerRef.current.getAll() : s.splits,
    }));
  }, []);

  const drainAndProcess = useCallback(async () => {
    const samples = await drainLocationBuffer();
    if (!samples.length) return;
    samples.sort((a, b) => a.timestamp - b.timestamp).forEach(processSample);
  }, [processSample]);

  const updateNotification = useCallback((paused: boolean) => {
    const distText = `${formatDist(distanceRef.current)}${distUnit(distanceRef.current)}`;
    const timeText = formatTime(elapsedRef.current);
    showActivityNotification(paused ? 'PaasXO — Paused' : 'PaasXO — Tracking', `${timeText} · ${distText}`);
  }, []);

  const startTimers = useCallback(() => {
    drainIntervalRef.current = setInterval(drainAndProcess, DRAIN_INTERVAL_MS);
    tickIntervalRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setStats((s) => ({ ...s, elapsedSeconds: elapsedRef.current }));
    }, 1000);
    notifyIntervalRef.current = setInterval(() => updateNotification(false), NOTIFICATION_UPDATE_INTERVAL_MS);
  }, [drainAndProcess, updateNotification]);

  const startPedometer = useCallback(async () => {
    if (pedometerSubRef.current) return;
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) return;
      pedometerSubRef.current = Pedometer.watchStepCount((result) => {
        stepCountRef.current = result.steps;
        setStats((s) => ({ ...s, stepCount: result.steps }));
      });
    } catch {
      // Pedometer unavailable/denied on this device — step count just stays
      // null for the whole session, never blocks the rest of tracking.
    }
  }, []);

  const stopLocationAndTimers = useCallback(async () => {
    if (drainIntervalRef.current) { clearInterval(drainIntervalRef.current); drainIntervalRef.current = null; }
    if (tickIntervalRef.current) { clearInterval(tickIntervalRef.current); tickIntervalRef.current = null; }
    if (notifyIntervalRef.current) { clearInterval(notifyIntervalRef.current); notifyIntervalRef.current = null; }
    pedometerSubRef.current?.remove();
    pedometerSubRef.current = null;
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(ACTIVITY_LOCATION_TASK);
      if (running) await Location.stopLocationUpdatesAsync(ACTIVITY_LOCATION_TASK);
    } catch {
      // Task was never started, or already stopped — nothing to clean up.
    }
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;

    // Best-effort — this is what "Always" (background) access needs on iOS
    // for tracking to survive the phone locking, but a denial never blocks
    // starting the session; it just falls back to foreground-only delivery.
    let backgroundGranted = false;
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      backgroundGranted = bg.status === 'granted';
    } catch {
      // Not supported on this platform/OS version — proceed foreground-only.
    }

    await clearLocationBuffer();
    routeRef.current = [];
    distanceRef.current = 0;
    maxSpeedRef.current = 0;
    elevationRef.current = new ElevationTracker();
    splitTrackerRef.current = new SplitTracker(activityType !== 'CYCLING');
    elapsedRef.current = 0;
    lastProcessedTimestampRef.current = 0;
    stepCountRef.current = null;
    currentLocationRef.current = null;
    startTimeRef.current = new Date();
    setStats({ ...emptyStats(), backgroundPermissionGranted: backgroundGranted });

    await Location.startLocationUpdatesAsync(ACTIVITY_LOCATION_TASK, locationTaskOptions);
    startTimers();
    updateNotification(false);
    await startPedometer();

    setPhase('ACTIVE');
    return true;
  }, [activityType, startTimers, updateNotification, startPedometer]);

  const pause = useCallback(async () => {
    await drainAndProcess(); // capture anything buffered right up to the pause moment
    await stopLocationAndTimers();
    setPhase('PAUSED');
    updateNotification(true);
  }, [drainAndProcess, stopLocationAndTimers, updateNotification]);

  const resume = useCallback(async () => {
    await Location.startLocationUpdatesAsync(ACTIVITY_LOCATION_TASK, locationTaskOptions);
    startTimers();
    await startPedometer();
    setPhase('ACTIVE');
    updateNotification(false);
  }, [startTimers, startPedometer, updateNotification]);

  const stop = useCallback(async (): Promise<FinishedActivityData> => {
    await drainAndProcess();
    await stopLocationAndTimers();
    await dismissActivityNotification();
    setPhase('IDLE');

    const coords = routeRef.current;
    const last = coords[coords.length - 1];
    const startTime = startTimeRef.current ?? new Date();
    const endTime = new Date();
    // Wall-clock delta, not the accumulated 1s-tick counter — setInterval
    // can be throttled while backgrounded, so the tick count alone would
    // under-report a session that spent time locked/backgrounded.
    const durationSeconds = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000));
    const distanceMeters = distanceRef.current;

    return {
      durationSeconds,
      distanceMeters,
      avgSpeedKmh: durationSeconds > 0
        ? parseFloat(((distanceMeters / 1000) / (durationSeconds / 3600)).toFixed(2))
        : 0,
      maxSpeedKmh: parseFloat(maxSpeedRef.current.toFixed(2)),
      avgPaceSecPerKm: activityType !== 'CYCLING' ? calcPaceSecPerKm(distanceMeters, durationSeconds) : null,
      elevationGainMeters: Math.round(elevationRef.current.gainMeters),
      elevationLossMeters: Math.round(elevationRef.current.lossMeters),
      stepCount: stepCountRef.current,
      route: coords,
      splits: splitTrackerRef.current.getAll(),
      startLatitude: coords[0]?.latitude ?? currentLocationRef.current?.latitude ?? 0,
      startLongitude: coords[0]?.longitude ?? currentLocationRef.current?.longitude ?? 0,
      endLatitude: last?.latitude,
      endLongitude: last?.longitude,
      startTime,
      endTime,
    };
  }, [activityType, drainAndProcess, stopLocationAndTimers]);

  // Drain immediately on returning to the foreground while ACTIVE, so the UI
  // catches up on anything collected while backgrounded instead of waiting
  // for the next poll tick.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && phase === 'ACTIVE') drainAndProcess();
    });
    return () => sub.remove();
  }, [phase, drainAndProcess]);

  // Safety net — if the screen unmounts while still tracking (e.g. the user
  // navigates away unexpectedly), don't leave the OS-level location task and
  // a stale notification running forever.
  useEffect(() => {
    return () => {
      stopLocationAndTimers();
      dismissActivityNotification();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { phase, stats, start, pause, resume, stop };
}
