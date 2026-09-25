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

// ── Elevation ──────────────────────────────────────────────────────────────
// Consumer-GPS altitude is commonly noisy by ±10-30m even standing still.
// Naively summing every raw increase (the previous implementation) reads
// pure GPS jitter as "elevation gained". This applies a short moving average
// plus a minimum-delta noise floor before accumulating gain/loss — the same
// class of technique (smoothing + noise threshold) fitness platforms like
// Strava/Garmin use, not a novel or unproven approach.
const ELEVATION_WINDOW = 5;
const ELEVATION_MIN_DELTA_M = 2;

export class ElevationTracker {
  private window: number[] = [];
  private lastSmoothed: number | null = null;
  gainMeters = 0;
  lossMeters = 0;

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

  addSample(altitudeMeters: number | null | undefined): void {
    if (altitudeMeters == null || Number.isNaN(altitudeMeters)) return;
    this.window.push(altitudeMeters);
    if (this.window.length > ELEVATION_WINDOW) this.window.shift();
    const smoothed = this.window.reduce((a, b) => a + b, 0) / this.window.length;

    if (this.lastSmoothed == null) {
      this.lastSmoothed = smoothed;
      return;
    }
    const delta = smoothed - this.lastSmoothed;
    if (Math.abs(delta) < ELEVATION_MIN_DELTA_M) return; // within noise floor — ignore, don't shift baseline
    if (delta > 0) this.gainMeters += delta;
    else this.lossMeters += -delta;
    this.lastSmoothed = smoothed;
  }
}

// ── Per-kilometer splits ──────────────────────────────────────────────────
export interface LiveSplit {
  index: number; // 1-based
  durationSeconds: number;
  paceSecPerKm: number | null; // null for CYCLING — see avgSpeedKmh instead
  avgSpeedKmh: number;
}

export class SplitTracker {
  private splits: LiveSplit[] = [];
  private lastSplitDistanceM = 0;
  private lastSplitElapsedS = 0;

  constructor(private readonly isPaceBased: boolean) {}

  /** Reconstructs a tracker after an app-kill/resume with its completed
   * splits and baseline intact, so the next completed kilometer is measured
   * from where the session actually left off rather than from zero. */
  static restore(isPaceBased: boolean, splits: LiveSplit[], lastSplitDistanceM: number, lastSplitElapsedS: number): SplitTracker {
    const t = new SplitTracker(isPaceBased);
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
    const paceSecPerKm = this.isPaceBased && segDurationS > 0
      ? Math.round(segDurationS / (segDistM / 1000))
      : null;
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
/** Best (fastest/lowest) single completed-km split — null for CYCLING or if
 * no full km was ever completed. Stored alongside the activity (see
 * activityApi.ts's StoredActivity.bestSplitPaceSecPerKm) so cross-activity
 * "fastest km ever" queries don't need to re-scan every activity's splits. */
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
 * Calories = MET x weight(kg) x duration(hours) — the standard formula, using
 * the whole activity's average speed to pick the MET band rather than
 * segmenting per split (the same granularity most consumer trackers use: an
 * approximate estimate, not a lab-precise one). Returns null when weight is
 * unknown rather than guessing — see User.weightKg's doc comment on the
 * backend for why a number here is never fabricated.
 */
export function calcCalories(
  type: MetActivityType,
  avgSpeedKmh: number,
  durationSeconds: number,
  weightKg: number | null | undefined
): number | null {
  if (!weightKg || weightKg <= 0 || durationSeconds <= 0) return null;
  const met = metFor(type, avgSpeedKmh);
  const hours = durationSeconds / 3600;
  return Math.round(met * weightKg * hours);
}
