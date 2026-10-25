import { Trophy, Users, Dumbbell, Activity, Footprints, PersonStanding, Route, Plus, LucideIcon } from 'lucide-react-native';

// Mirrors com.pasxo.dto.enums.Sport on the backend (minus FOOTBALL, which
// isn't offered as a selectable activity in this app yet).
export interface SportOption {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const SPORTS: SportOption[] = [
  { id: 'FUTSAL', label: 'Futsal', icon: Users },
  { id: 'CRICKET', label: 'Cricket', icon: Trophy },
  { id: 'PICKLEBALL', label: 'Pickleball', icon: Dumbbell },
  { id: 'PADDLEBALL', label: 'Paddleball', icon: Activity },
  { id: 'TRAINER_GYM', label: 'Trainer (Gym)', icon: Dumbbell },
  { id: 'GYM', label: 'Gym', icon: PersonStanding },
  { id: 'WALKING', label: 'Walking', icon: Footprints },
  { id: 'RUNNING', label: 'Running', icon: Route },
];

/** "Other" profile interest — the free-text names travel as otherSports. */
export const OTHER_SPORT_ID = 'OTHER';
export const OTHER_SPORT: SportOption = { id: OTHER_SPORT_ID, label: 'Other', icon: Plus };

/** Personal-activity interests a Service Provider account doesn't list. */
const PERSONAL_ONLY = new Set(['WALKING', 'RUNNING']);

/**
 * The selectable profile activities for an account type, "Other" last.
 * Service Providers don't get Walking/Running.
 */
export function profileActivityOptions(accountType: 'USER' | 'VENDOR' | string = 'USER'): SportOption[] {
  const base = accountType === 'VENDOR' ? SPORTS.filter((s) => !PERSONAL_ONLY.has(s.id)) : SPORTS;
  return [...base, OTHER_SPORT];
}

export function isPersonalOnlyActivity(id: string) {
  return PERSONAL_ONLY.has(id);
}

/** Same rules as the backend's AuthService.cleanOtherSports — max 3 × 30 chars. */
export function cleanOtherSports(raw: string): string {
  const out: string[] = [];
  for (const piece of raw.split(',')) {
    let t = piece.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (t.length > 30) t = t.slice(0, 30).trim();
    if (!out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length === 3) break;
  }
  return out.join(', ');
}

/**
 * "FUTSAL • CRICKET • SWIMMING" for a profile header — known ids use their
 * label, OTHER expands to the user's own free text.
 */
export function formatProfileActivities(sports?: string[] | string | null, otherSports?: string | null, fallback = 'SPORT PLAYER'): string {
  const list = Array.isArray(sports) ? sports : sports ? [sports] : [];
  const labels: string[] = [];
  for (const raw of list) {
    const id = String(raw).toUpperCase();
    if (id === OTHER_SPORT_ID) {
      if (otherSports?.trim()) otherSports.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => labels.push(t));
      continue;
    }
    labels.push(SPORTS.find((s) => s.id === id)?.label ?? id.replace(/_/g, ' '));
  }
  return labels.length ? labels.join(' • ').toUpperCase() : fallback;
}
