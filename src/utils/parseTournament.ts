import {
  TournamentRecord,
  TournamentTeamRecord,
  TournamentPlayerRecord,
  TournamentMatchRecord,
  TournamentTeamUI,
  TournamentMatchUI,
  TournamentUI,
  TournamentLifecycle,
} from '../types/api';
import { MatchOverride } from './tournamentStorage';

const TEAM_EMOJIS = ['⚡', '🔥', '🦁', '🐉', '🦅', '🐺', '🦈', '🐯', '🚀', '⭐', '🛡️', '👑'];
const TEAM_COLORS = [
  '#2977C2',
  '#F59E0B',
  '#22C55E',
  '#EF4444',
  '#A855F7',
  '#06B6D4',
  '#EC4899',
  '#84CC16',
];

const hashKey = (key: string) => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export const teamFlair = (team: { id: number; name: string }) => {
  const index = hashKey(`${team.id}-${team.name}`);
  return {
    emoji: TEAM_EMOJIS[index % TEAM_EMOJIS.length],
    color: TEAM_COLORS[index % TEAM_COLORS.length],
  };
};

export const buildTeamUI = (
  team: TournamentTeamRecord,
  players: TournamentPlayerRecord[] = []
): TournamentTeamUI => ({
  ...team,
  players,
  ...teamFlair(team),
});

export const buildMatchUI = (
  match: TournamentMatchRecord,
  teams: Map<number, TournamentTeamUI>,
  override?: MatchOverride
): TournamentMatchUI => {
  const teamAScore = override?.teamAScore ?? match.teamAScore;
  const teamBScore = override?.teamBScore ?? match.teamBScore;

  let derivedStatus: TournamentMatchUI['derivedStatus'] = 'SCHEDULED';
  if (override?.status) {
    derivedStatus = override.status;
  } else if (teamAScore != null || teamBScore != null) {
    derivedStatus = 'LIVE';
  } else if (match.status === 'COMPLETED' || match.status === 'LIVE') {
    derivedStatus = match.status as TournamentMatchUI['derivedStatus'];
  }

  return {
    ...match,
    teamAScore,
    teamBScore,
    teamA: teams.get(match.teamAId),
    teamB: teams.get(match.teamBId),
    derivedStatus,
  };
};

export const deriveTournamentLifecycle = (matches: TournamentMatchUI[]): TournamentLifecycle => {
  if (matches.length === 0) return 'UPCOMING';
  if (matches.every((m) => m.derivedStatus === 'COMPLETED')) return 'COMPLETED';
  if (matches.some((m) => m.derivedStatus === 'LIVE' || m.derivedStatus === 'COMPLETED')) {
    return 'LIVE';
  }
  return 'UPCOMING';
};

export const buildTournamentUI = (params: {
  tournament: TournamentRecord;
  teams: TournamentTeamUI[];
  matches: TournamentMatchUI[];
  venueName?: string;
  isOwner: boolean;
}): TournamentUI => {
  const { tournament, teams, matches, venueName, isOwner } = params;
  return {
    ...tournament,
    venueName,
    teams,
    matches,
    isOwner,
    lifecycle: deriveTournamentLifecycle(matches),
  };
};
