// The only sports a real, bookable Team Match Challenge can be played in —
// mirrors TeamMatchService.TEAM_MATCH_SPORTS on the backend, which enforces it.
export const TEAM_MATCH_SPORTS: { id: string; label: string }[] = [
  { id: 'FUTSAL', label: 'Futsal' },
  { id: 'CRICKET', label: 'Cricket' },
  { id: 'PICKLEBALL', label: 'Pickleball' },
  { id: 'PADDLEBALL', label: 'Paddleball' },
];

export function isTeamMatchSport(sport?: string | null): boolean {
  return !!sport && TEAM_MATCH_SPORTS.some((s) => s.id === sport.toUpperCase());
}

export function teamMatchSportLabel(sport?: string | null): string {
  if (!sport) return 'Team';
  return TEAM_MATCH_SPORTS.find((s) => s.id === sport.toUpperCase())?.label
    ?? sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();
}
