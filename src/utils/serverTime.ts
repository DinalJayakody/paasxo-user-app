// Server timestamps (Java LocalDateTime) arrive as UTC without a zone suffix and
// with microseconds, e.g. "2026-10-14T07:24:52.578329". Hermes rejects >3
// fractional digits and a zone-less string would be read as local time.

/** Epoch ms for a server timestamp (0 if missing/unparseable). */
export function serverTimeMs(value?: string | null): number {
  if (!value) return 0;
  const trimmed = value.replace(/(\.\d{3})\d+/, '$1');
  const iso = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed) ? trimmed : `${trimmed}Z`;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** "just now", "5m ago", "3h ago", "2d ago", else a short date — or null. */
export function serverTimeAgo(value?: string | null): string | null {
  const t = serverTimeMs(value);
  if (!t) return null;
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
