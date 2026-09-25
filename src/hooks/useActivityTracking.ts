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
import {
  PersistedTrackingSession, saveTrackingSession, clearTrackingSession,
} from '../lib/activeTrackingSession';

// Matches the emoji/label used in ActivityTrackerScreen.tsx's ACT config —
// kept as its own small map here rather than importing that screen's config,
// since this hook has no other dependency on screen-level UI code.
const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  WALK: '🚶 Walk',
  RUN: '🏃 Run',
  CYCLING: '🚴 Cycle',
};

/**
 * expo-location's requestBackgroundPermissionsAsync() has a known edge case
 * on iOS: whether it actually shows the "Change to Always Allow?" upgrade
 * dialog is entirely OS-timed, not app-timed, and if iOS declines to show
 * one, the native promise can simply never settle. Without a timeout, that
 * hangs the whole start() chain forever — with the countdown screen frozen
 * on whatever it last rendered ("1", the number right before beginTracking()
 * calls start()), which read as "the countdown gets stuck at 1". Background
 * permission is already optional/best-effort here (see start()'s comment),
 * so timing out is treated exactly like a denial — foreground-only tracking
 * still proceeds either way.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

const DRAIN_INTERVAL_MS = 2000;
const NOTIFICATION_UPDATE_INTERVAL_MS = 5000;
// Checkpointing the full session (route included) on every 2s drain would be
// a lot of AsyncStorage churn for a long session's growing route array —
// every 3rd drain (~6s) bounds that while still keeping an app-kill's worst
// case recovery loss small.
const CHECKPOINT_EVERY_N_DRAINS = 3;
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
  // Mirrors `phase` for the unmount safety-net effect below, which (with an
  // empty dep array, so it only ever registers its cleanup once) would
  // otherwise always see the stale phase='IDLE' from its very first render.
  const phaseRef = useRef<TrackingPhase>('IDLE');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const routeRef = useRef<RoutePoint[]>([]);
  const distanceRef = useRef(0);
  const maxSpeedRef = useRef(0);
  const elevationRef = useRef(new ElevationTracker());
  const splitTrackerRef = useRef(new SplitTracker(activityType !== 'CYCLING'));
  const startTimeRef = useRef<Date | null>(null);
  const elapsedRef = useRef(0);
  const lastProcessedTimestampRef = useRef(0);
  const stepCountRef = useRef<number | null>(null);
  // Pedometer.watchStepCount's `steps` is cumulative only since THAT
  // subscription started, resetting to 0 on every fresh watchStepCount call —
  // resuming a session needs to add new steps on top of the restored total,
  // not silently overwrite it the moment the first new pedometer tick lands.
  const stepCountBaseRef = useRef(0);
  const currentLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const drainIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pedometerSubRef = useRef<{ remove: () => void } | null>(null);
  const drainCountRef = useRef(0);
  // The session's real activity type at the moment tracking actually started —
  // kept separate from the `activityType` hook param so a resumed session
  // (which may have started before this specific hook instance existed, e.g.
  // after an app-kill) always checkpoints/restores as whatever it actually
  // was, never silently relabeled to whatever the caller's current param is.
  const sessionActivityTypeRef = useRef<ActivityType>(activityType);

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

  // Persists a full recoverable snapshot — see activeTrackingSession.ts's doc
  // comment for why the raw GPS buffer alone isn't enough to survive a kill.
  const checkpoint = useCallback(async (phaseOverride?: 'ACTIVE' | 'PAUSED') => {
    if (!startTimeRef.current) return; // nothing to checkpoint before start()
    const splitBaseline = splitTrackerRef.current.getBaseline();
    const session: PersistedTrackingSession = {
      activityType: sessionActivityTypeRef.current,
      startTime: startTimeRef.current.toISOString(),
      phase: phaseOverride ?? 'ACTIVE',
      distanceMeters: distanceRef.current,
      maxSpeedKmh: maxSpeedRef.current,
      elevationGainMeters: elevationRef.current.gainMeters,
      elevationLossMeters: elevationRef.current.lossMeters,
      route: routeRef.current,
      splits: splitTrackerRef.current.getAll(),
      lastSplitDistanceM: splitBaseline.lastSplitDistanceM,
      lastSplitElapsedS: splitBaseline.lastSplitElapsedS,
      stepCount: stepCountRef.current,
      lastProcessedTimestamp: lastProcessedTimestampRef.current,
    };
    await saveTrackingSession(session);
  }, []);

  const drainAndProcess = useCallback(async () => {
    const samples = await drainLocationBuffer();
    if (samples.length) {
      samples.sort((a, b) => a.timestamp - b.timestamp).forEach(processSample);
    }
    drainCountRef.current += 1;
    if (drainCountRef.current >= CHECKPOINT_EVERY_N_DRAINS) {
      drainCountRef.current = 0;
      checkpoint('ACTIVE');
    }
  }, [processSample, checkpoint]);

  const updateNotification = useCallback((paused: boolean) => {
    const distText = `${formatDist(distanceRef.current)}${distUnit(distanceRef.current)}`;
    const timeText = formatTime(elapsedRef.current);
    const label = ACTIVITY_TYPE_LABEL[activityType];
    showActivityNotification(
      `${label} — ${paused ? 'Paused' : 'Tracking'}`,
      `${timeText} · ${distText}`
    );
  }, [activityType]);

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
        const total = stepCountBaseRef.current + result.steps;
        stepCountRef.current = total;
        setStats((s) => ({ ...s, stepCount: total }));
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

  const start = useCallback(async (): Promise<{ started: boolean; backgroundGranted: boolean }> => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return { started: false, backgroundGranted: false };

    // Best-effort — this is what "Always" (background) access needs on iOS
    // for tracking to survive the phone locking, but a denial never blocks
    // starting the session; it just falls back to foreground-only delivery.
    // Timeout-guarded — see withTimeout's doc comment above for why this
    // specific call can otherwise hang start() forever.
    let backgroundGranted = false;
    try {
      const bg = await withTimeout(Location.requestBackgroundPermissionsAsync(), 6000);
      backgroundGranted = bg.status === 'granted';
    } catch {
      // Not supported on this platform/OS version, denied, or timed out —
      // proceed foreground-only.
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
    stepCountBaseRef.current = 0;
    currentLocationRef.current = null;
    startTimeRef.current = new Date();
    sessionActivityTypeRef.current = activityType;
    drainCountRef.current = 0;
    setStats({ ...emptyStats(), backgroundPermissionGranted: backgroundGranted });

    // Defensive: if a previous session ended abnormally (app killed/crashed
    // while ACTIVE, so stopLocationAndTimers's own stop() never ran) the OS
    // task can still be registered from last time. Starting it again while
    // it's already running has been observed to throw on some expo-location/
    // Android combinations rather than just updating in place, which — with
    // no try/catch around it before this fix — surfaced as the generic
    // "Couldn't start tracking" alert with no way to tell what actually
    // failed. Clearing any stale registration first makes this a no-op in
    // the normal case and fixes the stale-task case outright.
    try {
      if (await Location.hasStartedLocationUpdatesAsync(ACTIVITY_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(ACTIVITY_LOCATION_TASK);
      }
    } catch {
      // Nothing registered — fine, proceed to start fresh below.
    }

    try {
      await Location.startLocationUpdatesAsync(ACTIVITY_LOCATION_TASK, locationTaskOptions);
    } catch (e: any) {
      // Rethrown with the real underlying message attached (instead of
      // letting a bare native error surface as an unhelpful generic
      // failure) — see ActivityTrackerScreen.tsx's beginTracking, which
      // shows err.message directly so this is diagnosable on-screen without
      // needing device logs.
      throw new Error(`Failed to start location updates: ${e?.message ?? String(e)}`);
    }
    startTimers();
    updateNotification(false);
    await startPedometer();
    await checkpoint('ACTIVE'); // covers a kill in the first few seconds, before the first periodic checkpoint

    setPhase('ACTIVE');
    return { started: true, backgroundGranted };
  }, [activityType, startTimers, updateNotification, startPedometer, checkpoint]);

  const pause = useCallback(async () => {
    await drainAndProcess(); // capture anything buffered right up to the pause moment
    await stopLocationAndTimers();
    setPhase('PAUSED');
    updateNotification(true);
    await checkpoint('PAUSED'); // so a kill while paused still resumes into PAUSED, not ACTIVE
  }, [drainAndProcess, stopLocationAndTimers, updateNotification, checkpoint]);

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
    await clearTrackingSession();
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

  /**
   * Reconstructs an in-progress session from a checkpoint written before the
   * app was killed (see activeTrackingSession.ts) — restores every
   * accumulator (route/distance/elevation/splits/steps) so the resumed
   * session reads as a continuation, not a restart, then re-registers the
   * OS location task and timers exactly like start() does. Caller (the
   * screen) is responsible for setting its own UI phase and activity-type
   * selection to match `session.phase`/`session.activityType` — this only
   * restores the tracking engine itself.
   */
  const resumeFromSession = useCallback(async (session: PersistedTrackingSession) => {
    routeRef.current = session.route;
    distanceRef.current = session.distanceMeters;
    maxSpeedRef.current = session.maxSpeedKmh;
    elevationRef.current = ElevationTracker.restore(session.elevationGainMeters, session.elevationLossMeters);
    splitTrackerRef.current = SplitTracker.restore(
      session.activityType !== 'CYCLING', session.splits, session.lastSplitDistanceM, session.lastSplitElapsedS
    );
    lastProcessedTimestampRef.current = session.lastProcessedTimestamp;
    stepCountRef.current = session.stepCount;
    stepCountBaseRef.current = session.stepCount ?? 0;
    currentLocationRef.current = routeRef.current.length > 0
      ? { latitude: routeRef.current[routeRef.current.length - 1].latitude, longitude: routeRef.current[routeRef.current.length - 1].longitude }
      : null;
    startTimeRef.current = new Date(session.startTime);
    sessionActivityTypeRef.current = session.activityType;
    // Wall-clock, matching stop()'s own duration math — a session resumed
    // after sitting dead for a while should show that dead time as elapsed,
    // same as if the app had just been slow to reopen, not silently erase it.
    elapsedRef.current = Math.max(0, Math.round((Date.now() - startTimeRef.current.getTime()) / 1000));
    drainCountRef.current = 0;

    setStats((s) => ({
      ...s,
      distanceMeters: distanceRef.current,
      maxSpeedKmh: maxSpeedRef.current,
      elevationGainMeters: Math.round(elevationRef.current.gainMeters),
      elevationLossMeters: Math.round(elevationRef.current.lossMeters),
      route: routeRef.current,
      mapCoords: routeRef.current.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
      currentLocation: currentLocationRef.current,
      splits: splitTrackerRef.current.getAll(),
      stepCount: stepCountRef.current,
      elapsedSeconds: elapsedRef.current,
    }));

    if (session.phase === 'PAUSED') {
      setPhase('PAUSED');
      updateNotification(true);
      await checkpoint('PAUSED');
      return;
    }

    // Defensive re-registration, same reasoning as start()'s own — the OS
    // task may or may not still be alive depending on how the app died.
    try {
      if (await Location.hasStartedLocationUpdatesAsync(ACTIVITY_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(ACTIVITY_LOCATION_TASK);
      }
    } catch {
      // Nothing registered — fine, proceed to start fresh below.
    }
    try {
      await Location.startLocationUpdatesAsync(ACTIVITY_LOCATION_TASK, locationTaskOptions);
    } catch (e: any) {
      throw new Error(`Failed to resume location updates: ${e?.message ?? String(e)}`);
    }
    startTimers();
    updateNotification(false);
    await startPedometer();
    setPhase('ACTIVE');
    await checkpoint('ACTIVE');
  }, [startTimers, updateNotification, startPedometer, checkpoint]);

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
  // a stale notification running forever. Guarded to phase !== 'IDLE': this
  // hook instance never actually started/resumed anything in the IDLE case
  // (e.g. the app-kill resume prompt was showing but never answered before
  // the screen unmounted) — stopping here would wrongly tear down a session
  // that's still legitimately running in the background, waiting to be
  // resumed next time the screen mounts.
  useEffect(() => {
    return () => {
      if (phaseRef.current === 'IDLE') return;
      stopLocationAndTimers();
      dismissActivityNotification();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { phase, stats, start, pause, resume, stop, resumeFromSession };
}
