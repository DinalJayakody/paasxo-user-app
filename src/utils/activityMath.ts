/**
 * Pure, unit-testable computation for the activity-tracking feature —
 * distance, pace, elevation smoothing, and per-kilometer splits. Kept
 * separate from useActivityTracking.ts (which owns the stateful GPS/
 * notification/pedometer wiring) so the actual math can be reasoned about
 * and verified independently of React/Expo APIs.
 */

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)}`;
  return (m / 1000).toFixed(2);
}

export function distUnit(m: number): string {
  return m < 1000 ? 'm' : 'km';
}

/** Average pace over the whole distance/duration so far — null (shown as
 * "--:--") until there's enough signal to be meaningful. */
export function calcPaceSecPerKm(distM: number, secs: number): number | null {
  if (distM < 50 || secs < 5) return null;
  return Math.round(secs / (distM / 1000));
}

export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null) return '--:--';
  const m = Math.floor(secPerKm / 60);
  const s = secPerKm % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Pace over roughly the last `windowSeconds` of the route — what "current
 * pace" should mean (the whole-session average is a separate number). Null
 * until there's at least 20m of movement in the window, so standing at a
 * crossing reads "--:--" rather than a wild number.
 */
export function rollingPaceSecPerKm(
  route: { latitude: number; longitude: number; timestamp: number }[],
  windowSeconds = 30,
): number | null {
  if (route.length < 2) return null;
  const end = route[route.length - 1].timestamp;
  let dist = 0;
  let startTs = end;
  for (let i = route.length - 1; i > 0; i--) {
    const a = route[i - 1];
    const b = route[i];
    if (end - a.timestamp > windowSeconds * 1000) break;
    dist += haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
    startTs = a.timestamp;
  }
  const secs = (end - startTs) / 1000;
  if (dist < 20 || secs < 5) return null;
  return Math.round(secs / (dist / 1000));
}

// ── Elevation ──────────────────────────────────────────────────────────────
// Consumer-GPS altitude is commonly noisy by ±10-30m even standing still.
// Naively summing every raw increase (the previous implementation) reads
// pure GPS jitter as "elevation gained". This applies a short moving average
// plus a minimum-delta noise floor before accumulating gain/loss — the same
// class of technique (smoothing + noise threshold) fitness platforms like
// Strava/Garmin use, not a novel or unproven approach.
//
// The noise floor depends on the source: a barometer (iOS CMAltimeter /
// Android pressure sensor) resolves ~0.1m, GPS altitude is ±5-15m, so GPS
// needs a much wider window and a higher threshold or jitter reads as hills.
const ELEVATION_GPS = { window: 30, minDelta: 5 };
const ELEVATION_BARO = { window: 3, minDelta: 1 };
/** GPS altitude samples with a worse vertical accuracy than this are ignored. */
export const MAX_ALTITUDE_ACCURACY_M = 15;

export class ElevationTracker {
  private window: number[] = [];
  private lastSmoothed: number | null = null;
  private cfg = ELEVATION_GPS;
  gainMeters = 0;
  lossMeters = 0;

  /**
   * Switch to barometer samples. The barometer reports altitude relative to
   * its own first reading (≈0) while GPS reports metres above sea level, so
   * the baseline must restart — otherwise the jump between the two sources
   * was counted as a huge fake climb or descent.
   */
  useBarometer(): void {
    this.cfg = ELEVATION_BARO;
    this.rebase();
  }

  /** Forget the smoothing baseline (keeps totals) — next sample starts fresh. */
  rebase(): void {
    this.window = [];
    this.lastSmoothed = null;
  }

  /**
   * Reconstructs a tracker after an app-kill/resume with its accumulated
   * totals intact — the private smoothing window/baseline can't be
   * meaningfully restored (it was never persisted, only the running totals
   * were), so it just starts fresh from the next sample, same as a brand
   * new tracker. That's a one-sample discontinuity at the resume point at
   * worst, not a lost session.
   */
  static restore(gainMeters: number, lossMeters: number): ElevationTracker {
    const t = new ElevationTracker();
    t.gainMeters = gainMeters;
    t.lossMeters = lossMeters;
    return t;
  }

  addSample(altitudeMeters: number | null | undefined, verticalAccuracyM?: number | null): void {
    if (altitudeMeters == null || Number.isNaN(altitudeMeters)) return;
    if (verticalAccuracyM != null && verticalAccuracyM > MAX_ALTITUDE_ACCURACY_M) return;
    this.window.push(altitudeMeters);
    if (this.window.length > this.cfg.window) this.window.shift();
    // Don't judge a trend until the window is full — the first few samples
    // of a GPS session are the least reliable.
    if (this.window.length < this.cfg.window && this.lastSmoothed == null) return;
    const smoothed = this.window.reduce((a, b) => a + b, 0) / this.window.length;

    if (this.lastSmoothed == null) {
      this.lastSmoothed = smoothed;
      return;
    }
    const delta = smoothed - this.lastSmoothed;
    if (Math.abs(delta) < this.cfg.minDelta) return; // within noise floor — ignore, don't shift baseline
    if (delta > 0) this.gainMeters += delta;
    else this.lossMeters += -delta;
    this.lastSmoothed = smoothed;
  }
}

// ── Per-kilometer splits ──────────────────────────────────────────────────
export interface LiveSplit {
  index: number; // 1-based
  durationSeconds: number;
  paceSecPerKm: number | null; // null only if the segment somehow took 0s
  avgSpeedKmh: number;
}

export class SplitTracker {
  private splits: LiveSplit[] = [];
  private lastSplitDistanceM = 0;
  private lastSplitElapsedS = 0;

  /** Reconstructs a tracker after an app-kill/resume with its completed
   * splits and baseline intact, so the next completed kilometer is measured
   * from where the session actually left off rather than from zero. */
  static restore(splits: LiveSplit[], lastSplitDistanceM: number, lastSplitElapsedS: number): SplitTracker {
    const t = new SplitTracker();
    t.splits = [...splits];
    t.lastSplitDistanceM = lastSplitDistanceM;
    t.lastSplitElapsedS = lastSplitElapsedS;
    return t;
  }

  /** Call on every distance/time update. Returns the newly-completed split
   * (there can be at most one per call given the ~3m GPS sample spacing),
   * or null if no new kilometer has been completed yet. */
  update(cumulativeDistanceM: number, cumulativeElapsedS: number): LiveSplit | null {
    if (cumulativeDistanceM - this.lastSplitDistanceM < 1000) return null;

    const segDistM = cumulativeDistanceM - this.lastSplitDistanceM;
    const segDurationS = cumulativeElapsedS - this.lastSplitElapsedS;
    const paceSecPerKm = segDurationS > 0 ? Math.round(segDurationS / (segDistM / 1000)) : null;
    const avgSpeedKmh = segDurationS > 0 ? (segDistM / 1000) / (segDurationS / 3600) : 0;

    const split: LiveSplit = {
      index: this.splits.length + 1,
      durationSeconds: segDurationS,
      paceSecPerKm,
      avgSpeedKmh: parseFloat(avgSpeedKmh.toFixed(2)),
    };
    this.splits.push(split);
    this.lastSplitDistanceM = cumulativeDistanceM;
    this.lastSplitElapsedS = cumulativeElapsedS;
    return split;
  }

  getAll(): LiveSplit[] {
    return [...this.splits];
  }

  /** Snapshot of the private baseline fields — for persisting a resumable
   * session (see SplitTracker.restore). */
  getBaseline(): { lastSplitDistanceM: number; lastSplitElapsedS: number } {
    return { lastSplitDistanceM: this.lastSplitDistanceM, lastSplitElapsedS: this.lastSplitElapsedS };
  }
}

export function genLocalId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Personal bests ─────────────────────────────────────────────────────────
/** Best (fastest/lowest) single completed-km split, for every activity type
 * including CYCLING — null only if no full km was ever completed. Stored
 * alongside the activity (see activityApi.ts's StoredActivity.
 * bestSplitPaceSecPerKm) so cross-activity "fastest km ever" queries don't
 * need to re-scan every activity's splits. */
export function bestSplitPaceSecPerKm(splits: LiveSplit[]): number | null {
  const paces = splits.map((s) => s.paceSecPerKm).filter((p): p is number => p != null);
  return paces.length ? Math.min(...paces) : null;
}

/** CYCLING counterpart to bestSplitPaceSecPerKm — best (highest) single-km avg speed. */
export function bestSplitSpeedKmh(splits: LiveSplit[]): number | null {
  if (!splits.length) return null;
  return Math.max(...splits.map((s) => s.avgSpeedKmh));
}

interface TimedPoint {
  latitude: number;
  longitude: number;
  timestamp: number; // epoch millis, strictly increasing along the route
}

/**
 * Fastest continuous 400m found anywhere in a recorded route — real
 * GPS-derived data (not interpolated from 1km splits, which are too coarse
 * for this). Two-pointer sliding window over cumulative distance, O(n):
 * cumulative distance is monotonically non-decreasing by construction (each
 * step adds a >=0 haversine distance), so as `end` advances, the furthest
 * valid `start` only ever moves forward too — no need to recheck earlier
 * positions. Returns null if the route never covers 400m continuously.
 */
export function fastest400mSeconds(route: TimedPoint[]): number | null {
  if (route.length < 2) return null;
  const TARGET_M = 400;

  const cumDist: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineMeters(route[i - 1].latitude, route[i - 1].longitude, route[i].latitude, route[i].longitude));
  }
  if (cumDist[cumDist.length - 1] < TARGET_M) return null;

  let best: number | null = null;
  let start = 0;
  for (let end = 0; end < route.length; end++) {
    while (start < end && cumDist[end] - cumDist[start + 1] >= TARGET_M) start++;
    if (cumDist[end] - cumDist[start] >= TARGET_M) {
      const durationS = (route[end].timestamp - route[start].timestamp) / 1000;
      if (durationS > 0 && (best == null || durationS < best)) best = durationS;
    }
  }
  return best != null ? Math.round(best) : null;
}

// ── Calories ───────────────────────────────────────────────────────────────
export type MetActivityType = 'WALK' | 'RUN' | 'CYCLING';

/**
 * MET (metabolic equivalent) by activity + average speed band, from the
 * Ainsworth Compendium of Physical Activities — the standard reference table
 * most consumer fitness trackers/apps use for exercise calorie estimates.
 */
function metFor(type: MetActivityType, avgSpeedKmh: number): number {
  // Effectively standing still (waiting at a light, GPS-only drift) —
  // "standing, light effort" in the Compendium.
  if (type !== 'CYCLING' && avgSpeedKmh < 1.5) return 1.3;
  if (type === 'CYCLING' && avgSpeedKmh < 5) return 1.3;
  // Classify by what the speed says the body is doing, not the label picked
  // at the start: a "Run" at 5 km/h is a walk, a "Walk" at 9 km/h is a run.
  if (type === 'RUN' && avgSpeedKmh < 6.5) type = 'WALK';
  else if (type === 'WALK' && avgSpeedKmh >= 8.0) type = 'RUN';
  if (type === 'WALK') {
    if (avgSpeedKmh < 4.0) return 2.8;
    if (avgSpeedKmh < 4.8) return 3.0;
    if (avgSpeedKmh < 5.6) return 3.5;
    if (avgSpeedKmh < 6.4) return 4.3;
    if (avgSpeedKmh < 7.2) return 5.0;
    return 6.3; // brisk/race-walking pace
  }
  if (type === 'RUN') {
    if (avgSpeedKmh < 8.0) return 6.0;
    if (avgSpeedKmh < 9.7) return 8.3;
    if (avgSpeedKmh < 10.8) return 9.8;
    if (avgSpeedKmh < 11.3) return 10.5;
    if (avgSpeedKmh < 12.1) return 11.0;
    if (avgSpeedKmh < 12.9) return 11.8;
    if (avgSpeedKmh < 13.9) return 12.3;
    if (avgSpeedKmh < 16.0) return 12.8;
    if (avgSpeedKmh < 17.5) return 14.5;
    return 16.0;
  }
  // CYCLING
  if (avgSpeedKmh < 16.0) return 4.0;
  if (avgSpeedKmh < 19.0) return 6.8;
  if (avgSpeedKmh < 22.4) return 8.0;
  if (avgSpeedKmh < 25.6) return 10.0;
  if (avgSpeedKmh < 30.6) return 12.0;
  return 15.8;
}

/**
 * Calories = MET x weight(kg) x duration(hours) — the standard formula.
 * When per-km splits are available, the MET band is picked per-split from
 * that segment's own avg speed and the results summed, rather than applying
 * one MET value to the whole duration — materially more accurate for a
 * variable-pace activity (intervals, a walk that breaks into a run, etc.),
 * since a single whole-activity average can land in the wrong MET band for
 * both the fast and slow portions. Only the trailing partial segment (after
 * the last full km, if any) falls back to the whole-activity average speed,
 * since it has no split of its own yet. Falls back to that same whole-
 * activity-average approach entirely when no split has completed (e.g. an
 * activity shorter than 1km). Returns null when weight is unknown rather
 * than guessing — see User.weightKg's doc comment on the backend for why a
 * number here is never fabricated.
 */
export function calcCalories(
  type: MetActivityType,
  avgSpeedKmh: number,
  durationSeconds: number,
  weightKg: number | null | undefined,
  splits: LiveSplit[] = []
): number | null {
  if (!weightKg || weightKg <= 0 || durationSeconds <= 0) return null;
  // Active calories (net of the ~1 MET the body burns at rest anyway) —
  // what Apple Health/Strava/Garmin show for a workout. Gross MET counted
  // resting metabolism too, which inflated every estimate (and made a long
  // stop look like exercise).
  const netMet = (speed: number) => Math.max(0, metFor(type, speed) - 1);

  if (splits.length > 0) {
    const splitSeconds = splits.reduce((sum, s) => sum + s.durationSeconds, 0);
    let kcal = splits.reduce(
      (sum, s) => sum + netMet(s.avgSpeedKmh) * weightKg * (s.durationSeconds / 3600),
      0
    );
    const remainderSeconds = Math.max(0, durationSeconds - splitSeconds);
    if (remainderSeconds > 0) {
      kcal += netMet(avgSpeedKmh) * weightKg * (remainderSeconds / 3600);
    }
    return Math.round(kcal);
  }

  return Math.round(netMet(avgSpeedKmh) * weightKg * (durationSeconds / 3600));
}

// ── GPS distance (Kalman-smoothed) ─────────────────────────────────────────
export type GpsActivity = 'WALK' | 'RUN' | 'CYCLING';

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracy: number | null; // metres, 68% radius
  speed: number | null;    // m/s, may be null/negative when unknown
  timestamp: number;       // epoch ms
}

/** Fixes worse than this are unusable for distance (cell-tower level). */
export const MAX_FIX_ACCURACY_M = 50;
// How fast the true position can drift between fixes (m/s) — the Kalman
// process noise. Higher for faster activities so the filter keeps up.
const PROCESS_NOISE_MS: Record<GpsActivity, number> = { WALK: 2, RUN: 4, CYCLING: 8 };
// Physically implausible speeds (m/s), beyond the fix's own error radius —
// a jump faster than this is a GPS "teleport", not movement.
const MAX_SPEED_MS: Record<GpsActivity, number> = { WALK: 7, RUN: 11, CYCLING: 28 };
const MIN_COMMIT_M = 2.5;
// A segment is only committed once it is longer than this × the fix's error
// radius — committing every metre counted side-to-side GPS jitter as forward
// movement (simulated: +14–18% over-read). Measured within ±5% with this and
// the Doppler-speed cap below; standing still adds nothing.
const COMMIT_ACCURACY_FACTOR = 1.5;
// A committed segment can't be longer than the distance the phone's own
// (Doppler) speed says was covered since the last commit, plus this slack.
const SPEED_CAP_FACTOR = 1.1;
const SPEED_CAP_SLACK_M = 1;

/**
 * Turns raw GPS fixes into travelled distance the way fitness trackers do:
 *
 *  1. Accepts fixes up to MAX_FIX_ACCURACY_M (the old hard 20 m cut-off
 *     discarded every fix in ordinary city walking, leaving distance at 0).
 *  2. Smooths position with a Kalman filter weighted by each fix's reported
 *     accuracy — a poor fix nudges the estimate a little, a good one a lot.
 *  3. Rejects "teleports" (implied speed beyond what the activity allows),
 *     re-anchoring after a run of them (e.g. leaving a tunnel).
 *  4. Commits distance only once the smoothed position has moved further
 *     than its own uncertainty, so standing still adds nothing.
 */
export class GpsDistanceTracker {
  distanceMeters = 0;
  acceptedFixes = 0;
  private lat = 0;
  private lng = 0;
  private variance = -1; // m², < 0 = uninitialised
  private lastTs = 0;
  private anchor: { lat: number; lng: number } | null = null;
  private rejectStreak = 0;
  private lastStationary = false;
  // Distance the reported speed says we've covered since the anchor; only
  // trusted while every fix in the segment carried a speed.
  private speedDistSinceAnchor = 0;
  private speedKnown = true;

  constructor(private activity: GpsActivity, initialDistanceMeters = 0) {
    this.distanceMeters = initialDistanceMeters;
  }

  /** Commits the last stretch still inside the noise margin (call on pause/stop). */
  flush(): void {
    const pending = this.pendingMeters();
    if (pending >= MIN_COMMIT_M) this.commit(pending);
  }

  /** Committed distance plus the stretch since the last commit — what to show live, every second. */
  get liveDistanceMeters(): number {
    return this.distanceMeters + this.pendingMeters();
  }

  private pendingMeters(): number {
    if (!this.anchor || this.variance < 0 || this.lastStationary) return 0;
    return this.capped(haversineMeters(this.anchor.lat, this.anchor.lng, this.lat, this.lng));
  }

  private capped(moved: number): number {
    if (!this.speedKnown) return moved;
    return Math.min(moved, this.speedDistSinceAnchor * SPEED_CAP_FACTOR + SPEED_CAP_SLACK_M);
  }

  private commit(segment: number): void {
    this.distanceMeters += segment;
    this.anchor = { lat: this.lat, lng: this.lng };
    this.speedDistSinceAnchor = 0;
    this.speedKnown = true;
  }

  /** Forget the current position (after a pause) without losing distance. */
  resetPosition(): void {
    this.variance = -1;
    this.anchor = null;
    this.rejectStreak = 0;
    this.speedDistSinceAnchor = 0;
    this.speedKnown = true;
  }

  /** @returns the smoothed position if the fix was used, else null. */
  addFix(fix: GpsFix): { latitude: number; longitude: number } | null {
    if (!Number.isFinite(fix.latitude) || !Number.isFinite(fix.longitude)) return null;
    if (fix.accuracy != null && (fix.accuracy <= 0 || fix.accuracy > MAX_FIX_ACCURACY_M)) return null;
    const acc = Math.max(3, fix.accuracy ?? 10);

    if (this.variance < 0) {
      this.lat = fix.latitude;
      this.lng = fix.longitude;
      this.variance = acc * acc;
      this.lastTs = fix.timestamp;
      this.anchor = { lat: this.lat, lng: this.lng };
      this.acceptedFixes++;
      return { latitude: this.lat, longitude: this.lng };
    }

    const dt = Math.max(0, (fix.timestamp - this.lastTs) / 1000);
    const jump = haversineMeters(this.lat, this.lng, fix.latitude, fix.longitude);
    if (dt > 0 && (jump - acc) / dt > MAX_SPEED_MS[this.activity]) {
      this.rejectStreak++;
      if (this.rejectStreak < 5) return null;
      // Consistently somewhere else — trust the new position, add no distance for the gap.
      this.resetPosition();
      return this.addFix(fix);
    }
    this.rejectStreak = 0;

    if (dt > 0) {
      const q = PROCESS_NOISE_MS[this.activity];
      this.variance += dt * q * q;
      this.lastTs = fix.timestamp;
      if (fix.speed != null && fix.speed >= 0) this.speedDistSinceAnchor += fix.speed * dt;
      else this.speedKnown = false;
    }
    const k = this.variance / (this.variance + acc * acc);
    this.lat += k * (fix.latitude - this.lat);
    this.lng += k * (fix.longitude - this.lng);
    this.variance = (1 - k) * this.variance;
    this.acceptedFixes++;

    const anchor = this.anchor!;
    const moved = haversineMeters(anchor.lat, anchor.lng, this.lat, this.lng);
    const uncertainty = Math.sqrt(this.variance);
    const stationary = fix.speed != null && fix.speed >= 0 && fix.speed < 0.3 && moved < acc;
    this.lastStationary = fix.speed != null && fix.speed >= 0 && fix.speed < 0.3;
    if (!stationary && moved >= Math.max(MIN_COMMIT_M, uncertainty, COMMIT_ACCURACY_FACTOR * acc)) {
      this.commit(this.capped(moved));
    }
    return { latitude: this.lat, longitude: this.lng };
  }
}

// Average stride (m) for a step-count estimate — used only when GPS clearly
// failed (indoors, treadmill, no sky view), never to override good GPS.
const STRIDE_M: Partial<Record<GpsActivity, number>> = { WALK: 0.72, RUN: 1.05 };

/**
 * The distance to show: GPS, unless the step count proves GPS is badly
 * under-reading (less than half of what the steps imply) — then the
 * step-based estimate. Cycling is GPS-only.
 */
export function effectiveDistanceMeters(activity: GpsActivity, gpsMeters: number, steps: number | null): number {
  const stride = STRIDE_M[activity];
  if (!stride || !steps || steps <= 0) return gpsMeters;
  const fromSteps = steps * stride;
  return gpsMeters < fromSteps * 0.5 ? fromSteps : gpsMeters;
}
