const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Chat timestamps are ISO instants (UTC, with Z) — Date parses them correctly. */
export function parseInstant(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function clockTime(d: Date): string {
  const h = d.getHours();
  return `${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Inbox time: "now", "5m", "3h", "Mon", "12 Oct". */
export function inboxTime(iso?: string | null): string {
  const d = parseInstant(iso);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (startOfDay(d) === startOfDay(new Date())) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 6 * 86_400_000) return DAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Day separator: "Today", "Yesterday", "Mon, 12 Oct". */
export function dayLabel(d: Date): string {
  const today = startOfDay(new Date());
  const day = startOfDay(d);
  if (day === today) return 'Today';
  if (day === today - 86_400_000) return 'Yesterday';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
}

export function sameDay(a: Date, b: Date) {
  return startOfDay(a) === startOfDay(b);
}

/** "Active now" / "Active 5m ago" / "Active 2h ago" / "" */
export function presenceLabel(online: boolean, lastSeenAt?: string | null): string {
  if (online) return 'Active now';
  const d = parseInstant(lastSeenAt);
  if (!d) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'Active just now';
  if (mins < 60) return `Active ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Active ${hrs}h ago`;
  return '';
}

const SPORT_EMOJI: Record<string, string> = { FUTSAL: '⚽', CRICKET: '🏏', PICKLEBALL: '🏓', PADDLEBALL: '🎾' };
export const sportEmoji = (s?: string | null) => SPORT_EMOJI[(s ?? '').toUpperCase()] ?? '🏟️';

export function matchWhen(date?: string | null, start?: string | null): string {
  if (!date) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  let t = '';
  const tm = start ? /^(\d{2}):(\d{2})/.exec(start) : null;
  if (tm) {
    const h = +tm[1];
    t = ` · ${((h + 11) % 12) + 1}:${tm[2]} ${h < 12 ? 'AM' : 'PM'}`;
  }
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}${t}`;
}
