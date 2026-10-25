import axiosInstance from './axios';

export type MatchStatus = 'UPCOMING' | 'PENDING' | 'LIVE' | 'COMPLETED' | 'PLAYED' | 'CANCELLED' | 'EXPIRED';
export type MatchResult = 'WIN' | 'LOSS' | 'DRAW';

export interface FutsalStats {
  goals: number; assists: number; saves: number; yellowCards: number; redCards: number;
  hatTricks: number; cleanSheets: number; teamGoalsFor: number; teamGoalsAgainst: number;
  goalsPerMatch: number | null; bestMatchGoals: number;
}

export interface CricketStats {
  innings: number; runs: number; ballsFaced: number; notOuts: number;
  battingAverage: number | null; strikeRate: number | null; highestScore: number; highestNotOut: boolean;
  fours: number; sixes: number; fifties: number; hundreds: number; ducks: number;
  ballsBowled: number; overs: string; runsConceded: number; wickets: number;
  economy: number | null; bowlingAverage: number | null; bestBowling: string | null; threeWicketHauls: number;
}

export interface RacketStats {
  pointsWon: number; gamesWon: number; gamesLost: number; gameWinRate: number | null;
}

export interface SportStats {
  sport: string;
  matchesPlayed: number;
  decidedMatches: number;
  wins: number; losses: number; draws: number;
  winRate: number | null;
  form: ('W' | 'L' | 'D')[];
  currentStreak: string | null;
  bestWinStreak: number;
  upcoming: number; live: number; cancelled: number; organized: number;
  lastPlayedAt: string | null;
  futsal?: FutsalStats | null;
  cricket?: CricketStats | null;
  racket?: RacketStats | null;
}

export interface PlayerStats {
  firebaseUid: string;
  matchesPlayed: number;
  wins: number; losses: number; draws: number;
  winRate: number | null;
  upcoming: number;
  sports: SportStats[];
  generatedAt: string;
}

export interface MatchHistoryItem {
  bookingId: number;
  sport: string;
  title: string | null;
  venueName: string | null;
  startAt: string | null;
  status: MatchStatus;
  result: MatchResult | null;
  myTeamName: string | null;
  opponentName: string | null;
  myScore: number | null;
  opponentScore: number | null;
  scoreLabel: string | null;
  contribution: string | null;
  hasScorecard: boolean;
  organizer: boolean;
}

export interface MatchHistoryPage {
  content: MatchHistoryItem[];
  page: number;
  hasMore: boolean;
}

const enc = encodeURIComponent;

export const statsApi = {
  /** Real match stats for a player (server-side privacy: private accounts → 403). */
  getStats: async (uid: string): Promise<PlayerStats> => {
    const { data } = await axiosInstance.get(`/stats/users/${enc(uid)}`);
    return { ...data, sports: Array.isArray(data?.sports) ? data.sports : [] };
  },

  getMatches: async (uid: string, sport: string | null, page = 0, size = 10): Promise<MatchHistoryPage> => {
    const { data } = await axiosInstance.get(`/stats/users/${enc(uid)}/matches`, {
      params: { sport: sport ?? undefined, page, size },
    });
    return {
      content: Array.isArray(data?.content) ? data.content : [],
      page: typeof data?.page === 'number' ? data.page : page,
      hasMore: !!data?.hasMore,
    };
  },
};
