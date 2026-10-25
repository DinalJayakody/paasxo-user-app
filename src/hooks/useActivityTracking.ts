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
// Barometer is deliberately NOT a static import here — unlike Pedometer,
// requiring its native binding throws synchronously the instant the module
// is imported if the running build doesn't have it registered (e.g. Expo
// Go, or a build predating it). A top-level throw there would crash this
// whole file's module graph before any screen using it could even render —
// which is exactly what surfaced as the /activity-tracker route itself
// failing to load. Resolved lazily instead, inside startBarometer's own
// try/catch, so a missing/unavailable barometer can only ever disable that
// one optional feature (falls back to GPS-altitude elevation) and never
// take the screen down with it.
import {
  ACTIVITY_LOCATION_TASK, drainLocationBuffer, clearLocationBuffer, BufferedSample,
} from '../lib/activityLocationTask';
import { showActivityNotification, dismissActivityNotification } from '../lib/activityNotification';
import {
  GpsDistanceTracker, effectiveDistanceMeters, ElevationTracker, SplitTracker, LiveSplit, formatTime, formatDist, distUnit, calcPaceSecPerKm, formatPace,
  rollingPaceSecPerKm,
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

// Once a second, so distance (like the timer) visibly updates every second.
const DRAIN_INTERVAL_MS = 1000;
// This is a LOCAL notification re-issued in place under a fixed identifier —
// it never touches the backend/network, so the cost here is purely "how
// often does the OS redraw one notification," not an API/server cost. Even
// so, redrawing every few seconds is unnecessary churn for something only
// glanced at by pulling down the shade, and on some OS/battery-saver
// combinations very frequent local-notification updates get silently
// throttled. 30s keeps it feeling live without hammering it; a completed
// km split (see processSample below) also forces an immediate update
// in between, so a real milestone is never stale for up to 30s.
const NOTIFICATION_UPDATE_INTERVAL_MS = 30000;
// Checkpointing the full session (route included) on every 1s drain would be
// a lot of AsyncStorage churn for a long session's growing route array —
// every 6th drain (~6s) bounds that while still keeping an app-kill's worst
// case recovery loss small.
const CHECKPOINT_EVERY_N_DRAINS = 6;
// GPS filtering (accuracy gate, Kalman smoothing, teleport rejection,
// stationary suppression) lives in activityMath.ts's GpsDistanceTracker.

export type TrackingPhase = 'IDLE' | 'ACTIVE' | 'PAUSED';

// ── Single owner ────────────────────────────────────────────────────────────
// Only one mounted tracker may own the live session. If a second tracker
// screen mounts (e.g. tapping the activity notification while one is already
// open) and starts/resumes/finishes the session, every other instance stops
// its own timers and goes IDLE — otherwise a stale screen kept ticking its
// timer after the activity was finished and saved, looking like the session
// had "resumed".
let sessionOwner: symbol | null = null;
const ownerListeners = new Set<() => void>();
function claimSession(owner: symbol | null) {
  sessionOwner = owner;
  ownerListeners.forEach((l) => l());
}

export interface TrackingStats {
  elapsedSeconds: number;
  distanceMeters: number;
  currentSpeedKmh: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  /** Whole-session average pace (moving time). */
  currentPaceSecPerKm: number | null;
  /** Pace over the last ~30s — the "right now" number. */
  rollingPaceSecPerKm: number | null;
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
    currentPaceSecPerKm: null, rollingPaceSecPerKm: null, elevationGainMeters: 0, elevationLossMeters: 0, stepCount: null,
    splits: [], route: [], mapCoords: [], currentLocation: null, backgroundPermissionGranted: false,
  };
}

const locationTaskOptions: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  // ~1 fix per second (the GPS chip's native rate) so distance moves every
  // second; the Kalman filter in GpsDistanceTracker absorbs the extra jitter.
  timeInterval: 1000,
  distanceInterval: 1,
  pausesUpdatesAutomatically: false,
  // "While Using" permission is enough for a session the user starts: iOS
  // keeps delivering in the background and shows the blue location pill.
  showsBackgroundLocationIndicator: true,
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
  const ownerIdRef = useRef<symbol>(Symbol('tracker'));
  // True once another tracker screen took over this session (see onOwnerChange).
  const [superseded, setSuperseded] = useState(false);
  // Set while stop() is finishing: no checkpoint may be written after this,
  // or a finished session could be resurrected as "resumable".
  const finishingRef = useRef(false);
  const checkpointInFlight = useRef<Promise<void> | null>(null);

  const routeRef = useRef<RoutePoint[]>([]);
  const distanceRef = useRef(0); // what's shown: GPS, or steps when GPS clearly failed
  const gpsRef = useRef(new GpsDistanceTracker(activityType));
  const maxSpeedRef = useRef(0);
  const elevationRef = useRef(new ElevationTracker());
  const splitTrackerRef = useRef(new SplitTracker());
  const startTimeRef = useRef<Date | null>(null);
  const elapsedRef = useRef(0);
  // Moving time from the wall clock, not by counting interval ticks (those
  // get throttled while backgrounded, so a counted timer falls behind real
  // time). activeMsRef holds finished segments; segmentStartRef is the start
  // of the current un-paused segment (null while paused/stopped).
  const activeMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const activeSeconds = () =>
    Math.floor((activeMsRef.current + (segmentStartRef.current != null ? Date.now() - segmentStartRef.current : 0)) / 1000);
  const closeSegment = () => {
    if (segmentStartRef.current != null) {
      activeMsRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }
    elapsedRef.current = activeSeconds();
  };
  const lastProcessedTimestampRef = useRef(0);
  const stepCountRef = useRef<number | null>(null);
  // Pedometer.watchStepCount's `steps` is cumulative only since THAT
  // subscription started, resetting to 0 on every fresh watchStepCount call —
  // resuming a session needs to add new steps on top of the restored total,
  // not silently overwrite it the moment the first new pedometer tick lands.
  const stepCountBaseRef = useRef(0);
  const currentLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Elevation is normally fed from GPS altitude (noisy, ±10-30m even
  // standing still). When the device has a barometer, that's a far more
  // precise source for RELATIVE altitude change (the same approach Strava/
  // Garmin/Apple use) — once a first barometer reading confirms it's
  // available, GPS altitude samples are ignored for the rest of the session
  // so the two sources never mix into one noisy signal. baselinePressureRef
  // is only used on Android, where the sensor reports raw pressure (hPa)
  // rather than iOS's already-relative `relativeAltitude`.
  const useBarometerRef = useRef(false);
  const baselinePressureRef = useRef<number | null>(null);
  const barometerSubRef = useRef<{ remove: () => void } | null>(null);

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

    const smoothed = gpsRef.current.addFix(sample);
    if (!smoothed) return; // unusable fix (too inaccurate or a GPS jump) — no distance, no route kink
    // Live value includes the not-yet-committed stretch so the number moves every second.
    distanceRef.current = effectiveDistanceMeters(sessionActivityTypeRef.current, gpsRef.current.liveDistanceMeters, stepCountRef.current);
    // Ignored once the barometer has taken over (see useBarometerRef above) —
    // GPS altitude is only the fallback source for devices without one.
    if (!useBarometerRef.current) elevationRef.current.addSample(sample.altitude, sample.altitudeAccuracy);

    const speedKmh = sample.speed != null && sample.speed >= 0 ? sample.speed * 3.6 : 0;
    if (speedKmh > maxSpeedRef.current) maxSpeedRef.current = speedKmh;

    const point: RoutePoint = {
      latitude: smoothed.latitude,
      longitude: smoothed.longitude,
      timestamp: sample.timestamp,
      speedKmh,
      altitudeMeters: sample.altitude ?? undefined,
    };
    routeRef.current = [...routeRef.current, point];
    currentLocationRef.current = smoothed;

    const newSplit = splitTrackerRef.current.update(distanceRef.current, elapsedRef.current);
    // A completed km is a real milestone worth surfacing right away, rather
    // than waiting for the next 30s interval tick (see
    // NOTIFICATION_UPDATE_INTERVAL_MS) — this is the only thing that forces
    // an update in between ticks, so the notification still only redraws a
    // few times per km, not continuously.
    if (newSplit) updateNotification(false);

    setStats((s) => ({
      ...s,
      distanceMeters: distanceRef.current,
      currentSpeedKmh: parseFloat(speedKmh.toFixed(1)),
      maxSpeedKmh: parseFloat(maxSpeedRef.current.toFixed(1)),
      avgSpeedKmh: elapsedRef.current > 0
        ? parseFloat(((distanceRef.current / 1000) / (elapsedRef.current / 3600)).toFixed(1))
        : 0,
      currentPaceSecPerKm: calcPaceSecPerKm(distanceRef.current, elapsedRef.current),
      rollingPaceSecPerKm: rollingPaceSecPerKm(routeRef.current),
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
    if (finishingRef.current || sessionOwner !== ownerIdRef.current) return;
    const splitBaseline = splitTrackerRef.current.getBaseline();
    const session: PersistedTrackingSession = {
      activityType: sessionActivityTypeRef.current,
      startTime: startTimeRef.current.toISOString(),
      phase: phaseOverride ?? 'ACTIVE',
      distanceMeters: distanceRef.current,
      gpsDistanceMeters: gpsRef.current.distanceMeters,
      maxSpeedKmh: maxSpeedRef.current,
      elevationGainMeters: elevationRef.current.gainMeters,
      elevationLossMeters: elevationRef.current.lossMeters,
      route: routeRef.current,
      splits: splitTrackerRef.current.getAll(),
      lastSplitDistanceM: splitBaseline.lastSplitDistanceM,
      lastSplitElapsedS: splitBaseline.lastSplitElapsedS,
      stepCount: stepCountRef.current,
      lastProcessedTimestamp: lastProcessedTimestampRef.current,
      activeMs: activeMsRef.current + (segmentStartRef.current != null ? Date.now() - segmentStartRef.current : 0),
      savedAt: Date.now(),
    };
    const write = saveTrackingSession(session);
    checkpointInFlight.current = write;
    await write;
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

  // Reads sessionActivityTypeRef (set at start()/resumeFromSession() time)
  // rather than closing over the `activityType` hook param directly — this
  // callback is itself captured once, permanently, inside processSample's
  // empty-deps closure (see the newSplit branch below), so it must stay
  // correct no matter how many renders happen after that first capture;
  // a plain closure over `activityType` would go stale if the user switches
  // activity type on the picker after this hook's very first render.
  const updateNotification = useCallback((paused: boolean) => {
    const distText = `${formatDist(distanceRef.current)}${distUnit(distanceRef.current)}`;
    const timeText = formatTime(elapsedRef.current);
    const paceText = formatPace(calcPaceSecPerKm(distanceRef.current, elapsedRef.current));
    const label = ACTIVITY_TYPE_LABEL[sessionActivityTypeRef.current];
    const stepsText = stepCountRef.current != null ? `  👣 ${stepCountRef.current}` : '';
    showActivityNotification(
      `${label} — ${paused ? 'Paused' : 'Tracking'}`,
      `⏱ ${timeText}   📍 ${distText}   🏃 ${paceText}/km${stepsText}`,
      paused
    );
  }, []);

  const clearTimers = useCallback(() => {
    if (drainIntervalRef.current) { clearInterval(drainIntervalRef.current); drainIntervalRef.current = null; }
    if (tickIntervalRef.current) { clearInterval(tickIntervalRef.current); tickIntervalRef.current = null; }
    if (notifyIntervalRef.current) { clearInterval(notifyIntervalRef.current); notifyIntervalRef.current = null; }
  }, []);

  const startTimers = useCallback(() => {
    clearTimers(); // never two sets of intervals
    if (segmentStartRef.current == null) segmentStartRef.current = Date.now();
    drainIntervalRef.current = setInterval(drainAndProcess, DRAIN_INTERVAL_MS);
    // Sampled at 4 Hz but only re-rendered when the shown second changes, so
    // the clock never visibly skips or lags a second.
    tickIntervalRef.current = setInterval(() => {
      const secs = activeSeconds();
      if (secs === elapsedRef.current) return;
      elapsedRef.current = secs;
      setStats((s) => ({
        ...s,
        elapsedSeconds: secs,
        avgSpeedKmh: secs > 0 ? parseFloat(((distanceRef.current / 1000) / (secs / 3600)).toFixed(1)) : 0,
        currentPaceSecPerKm: calcPaceSecPerKm(distanceRef.current, secs),
      }));
    }, 250);
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
        distanceRef.current = effectiveDistanceMeters(sessionActivityTypeRef.current, gpsRef.current.liveDistanceMeters, total);
        setStats((s) => ({ ...s, stepCount: total, distanceMeters: distanceRef.current }));
      });
    } catch {
      // Pedometer unavailable/denied on this device — step count just stays
      // null for the whole session, never blocks the rest of tracking.
    }
  }, []);

  const startBarometer = useCallback(async () => {
    if (barometerSubRef.current) return;
    try {
      // Lazily resolved — see the import comment above for why this can't
      // be a static top-level import. require() with a literal module name
      // still bundles normally in Metro; the only difference is WHEN it
      // runs, which is what keeps a throw here contained to this try/catch.
      const { Barometer } = require('expo-sensors') as typeof import('expo-sensors');
      const available = await Barometer.isAvailableAsync();
      if (!available) return;
      Barometer.setUpdateInterval(1000); // barometer noise is low enough that 1Hz is plenty, and lighter on battery than GPS-rate polling
      barometerSubRef.current = Barometer.addListener((data) => {
        let altitude: number | null = null;
        if (data.relativeAltitude != null) {
          altitude = data.relativeAltitude; // iOS CMAltimeter — already relative to the first reading
        } else if (data.pressure > 0) {
          // Android reports raw pressure (hPa) only — derive relative altitude
          // via the standard barometric formula against this session's first
          // reading as the reference pressure.
          if (baselinePressureRef.current == null) baselinePressureRef.current = data.pressure;
          altitude = 44330 * (1 - Math.pow(data.pressure / baselinePressureRef.current, 1 / 5.255));
        }
        if (altitude != null) {
          if (!useBarometerRef.current) {
            useBarometerRef.current = true;
            elevationRef.current.useBarometer(); // new source, new baseline
          }
          elevationRef.current.addSample(altitude);
        }
      });
    } catch {
      // Unavailable/denied on this device — elevation stays on GPS altitude.
    }
  }, []);

  const stopLocationAndTimers = useCallback(async () => {
    clearTimers();
    pedometerSubRef.current?.remove();
    pedometerSubRef.current = null;
    barometerSubRef.current?.remove();
    barometerSubRef.current = null;
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

    // No "Always" request: a session the user starts in the foreground keeps
    // receiving locations with "While Using" access (iOS blue pill, Android
    // foreground-service notification), so the extra system prompt only
    // confused people. Reported for information only.
    let backgroundGranted = false;
    try {
      backgroundGranted = (await withTimeout(Location.getBackgroundPermissionsAsync(), 3000)).granted;
    } catch {
      // unknown — irrelevant to whether tracking works
    }

    finishingRef.current = false;
    setSuperseded(false);
    claimSession(ownerIdRef.current);
    await clearLocationBuffer();
    routeRef.current = [];
    distanceRef.current = 0;
    gpsRef.current = new GpsDistanceTracker(activityType);
    maxSpeedRef.current = 0;
    elevationRef.current = new ElevationTracker();
    splitTrackerRef.current = new SplitTracker();
    useBarometerRef.current = false;
    baselinePressureRef.current = null;
    elapsedRef.current = 0;
    activeMsRef.current = 0;
    segmentStartRef.current = null;
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
    segmentStartRef.current = Date.now(); // the clock starts when GPS does
    startTimers();
    updateNotification(false);
    await startPedometer();
    await startBarometer();
    await checkpoint('ACTIVE'); // covers a kill in the first few seconds, before the first periodic checkpoint

    setPhase('ACTIVE');
    return { started: true, backgroundGranted };
  }, [activityType, startTimers, updateNotification, startPedometer, startBarometer, checkpoint]);

  const pause = useCallback(async () => {
    // Freeze the clock first, so the time on screen stops the instant Pause is tapped.
    clearTimers();
    closeSegment();
    setStats((s) => ({ ...s, elapsedSeconds: elapsedRef.current }));
    await drainAndProcess(); // capture anything buffered right up to the pause moment
    gpsRef.current.flush();
    distanceRef.current = effectiveDistanceMeters(sessionActivityTypeRef.current, gpsRef.current.distanceMeters, stepCountRef.current);
    setStats((s) => ({ ...s, distanceMeters: distanceRef.current }));
    await stopLocationAndTimers();
    setPhase('PAUSED');
    updateNotification(true);
    await checkpoint('PAUSED'); // so a kill while paused still resumes into PAUSED, not ACTIVE
  }, [drainAndProcess, stopLocationAndTimers, updateNotification, checkpoint]);

  const resume = useCallback(async () => {
    // Where you walked while paused must not count: re-anchor at the next fix.
    gpsRef.current.resetPosition();
    await clearLocationBuffer();
    await Location.startLocationUpdatesAsync(ACTIVITY_LOCATION_TASK, locationTaskOptions);
    segmentStartRef.current = Date.now();
    startTimers();
    await startPedometer();
    await startBarometer();
    setPhase('ACTIVE');
    updateNotification(false);
  }, [startTimers, startPedometer, startBarometer, updateNotification]);

  const stop = useCallback(async (): Promise<FinishedActivityData> => {
    finishingRef.current = true;
    // Stop the clock the instant Finish is confirmed — the rest is teardown.
    clearTimers();
    closeSegment();
    const endTime = new Date();
    setStats((s) => ({ ...s, elapsedSeconds: elapsedRef.current }));
    await drainAndProcess();
    gpsRef.current.flush();
    distanceRef.current = effectiveDistanceMeters(sessionActivityTypeRef.current, gpsRef.current.distanceMeters, stepCountRef.current);
    // Teardown in parallel; a checkpoint started just before finishing must
    // land BEFORE the clear.
    const teardown = Promise.all([
      stopLocationAndTimers(),
      dismissActivityNotification().catch(() => {}),
      (async () => {
        await checkpointInFlight.current?.catch(() => {});
        await clearTrackingSession();
      })(),
    ]).catch(() => {});
    // The OS can take a few seconds to release location updates — don't hold
    // the summary hostage to it; teardown keeps running in the background.
    await Promise.race([teardown, new Promise((r) => setTimeout(r, 2500))]);
    if (sessionOwner === ownerIdRef.current) claimSession(null);
    setPhase('IDLE');

    const coords = routeRef.current;
    const last = coords[coords.length - 1];
    const startTime = startTimeRef.current ?? new Date();
    // Moving time only (paused stretches excluded), measured on the wall
    // clock — so pace/avg speed reflect the actual activity.
    const durationSeconds = Math.max(0, Math.round(activeMsRef.current / 1000));
    const distanceMeters = distanceRef.current;

    return {
      durationSeconds,
      distanceMeters,
      avgSpeedKmh: durationSeconds > 0
        ? parseFloat(((distanceMeters / 1000) / (durationSeconds / 3600)).toFixed(2))
        : 0,
      maxSpeedKmh: parseFloat(maxSpeedRef.current.toFixed(2)),
      avgPaceSecPerKm: calcPaceSecPerKm(distanceMeters, durationSeconds),
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
    finishingRef.current = false;
    setSuperseded(false);
    claimSession(ownerIdRef.current);
    routeRef.current = session.route;
    distanceRef.current = session.distanceMeters;
    gpsRef.current = new GpsDistanceTracker(session.activityType, session.gpsDistanceMeters ?? session.distanceMeters);
    maxSpeedRef.current = session.maxSpeedKmh;
    elevationRef.current = ElevationTracker.restore(session.elevationGainMeters, session.elevationLossMeters);
    splitTrackerRef.current = SplitTracker.restore(
      session.splits, session.lastSplitDistanceM, session.lastSplitElapsedS
    );
    // Whether the barometer was driving elevation before the kill isn't
    // persisted — restart the detection fresh, same one-sample-discontinuity
    // tradeoff ElevationTracker.restore's own doc comment already accepts.
    useBarometerRef.current = false;
    baselinePressureRef.current = null;
    lastProcessedTimestampRef.current = session.lastProcessedTimestamp;
    stepCountRef.current = session.stepCount;
    stepCountBaseRef.current = session.stepCount ?? 0;
    currentLocationRef.current = routeRef.current.length > 0
      ? { latitude: routeRef.current[routeRef.current.length - 1].latitude, longitude: routeRef.current[routeRef.current.length - 1].longitude }
      : null;
    startTimeRef.current = new Date(session.startTime);
    sessionActivityTypeRef.current = session.activityType;
    // Moving time as of the checkpoint. A session that was still ACTIVE when
    // the app died also gets the time since then (the user was still out
    // there); a PAUSED one resumes with exactly what it had. Older
    // checkpoints without activeMs fall back to start→now.
    if (session.activeMs != null) {
      const since = session.phase === 'ACTIVE' && session.savedAt ? Math.max(0, Date.now() - session.savedAt) : 0;
      activeMsRef.current = session.activeMs + since;
    } else {
      activeMsRef.current = Math.max(0, Date.now() - startTimeRef.current.getTime());
    }
    segmentStartRef.current = null;
    elapsedRef.current = activeSeconds();
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
    segmentStartRef.current = Date.now();
    startTimers();
    updateNotification(false);
    await startPedometer();
    await startBarometer();
    setPhase('ACTIVE');
    await checkpoint('ACTIVE');
  }, [startTimers, updateNotification, startPedometer, startBarometer, checkpoint]);

  // Drain immediately on returning to the foreground while ACTIVE, so the UI
  // catches up on anything collected while backgrounded instead of waiting
  // for the next poll tick.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && phase === 'ACTIVE') {
        drainAndProcess();
        elapsedRef.current = activeSeconds();
        setStats((st) => ({ ...st, elapsedSeconds: elapsedRef.current }));
      }
    });
    return () => sub.remove();
  }, [phase, drainAndProcess]);

  // Another tracker took over (or finished) the session: stop this instance's
  // own timers/sensors — never the OS location task, which now belongs to the
  // new owner — and go IDLE so the screen leaves its live view.
  useEffect(() => {
    const onOwnerChange = () => {
      // A tracker finishing its own session releases ownership itself — that
      // is not "another screen took over".
      if (sessionOwner === ownerIdRef.current || phaseRef.current === 'IDLE' || finishingRef.current) return;
      clearTimers();
      segmentStartRef.current = null;
      pedometerSubRef.current?.remove();
      pedometerSubRef.current = null;
      barometerSubRef.current?.remove();
      barometerSubRef.current = null;
      phaseRef.current = 'IDLE';
      setPhase('IDLE');
      setSuperseded(true);
    };
    ownerListeners.add(onOwnerChange);
    return () => { ownerListeners.delete(onOwnerChange); };
  }, []);

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
      if (phaseRef.current === 'IDLE' || sessionOwner !== ownerIdRef.current) return;
      stopLocationAndTimers();
      dismissActivityNotification();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { phase, stats, start, pause, resume, stop, resumeFromSession, superseded };
}
