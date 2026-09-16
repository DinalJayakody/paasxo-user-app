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
}

export function genLocalId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
