/**
 * yyyy-MM-dd in the device's local calendar. Date.toISOString() is UTC, so
 * in Sri Lanka (UTC+5:30) it returns yesterday's date between midnight and
 * 5:30am — every "today"/date-picker value must go through this instead.
 */
export function localYMD(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parses yyyy-MM-dd as a LOCAL date (new Date('2026-10-18') is UTC midnight). */
export function parseLocalYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
