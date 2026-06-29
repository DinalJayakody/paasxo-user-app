import AsyncStorage from '@react-native-async-storage/async-storage';

// The backend has no "list all tournaments" or "my tournaments" endpoint -
// only GET /futsals/{futsalId}/tournaments. So we keep a small local index
// of tournaments this device created or opened, purely so the app has a
// "My Tournaments" list to show. It's a presentation convenience, not a
// source of truth - the real tournament data always comes from the API.
const TRACKED_KEY = 'paasxo:tournaments:tracked';

// The backend also has no endpoint to persist a match score or a
// tournament/match lifecycle transition (TournamentMatch.teamAScore/
// teamBScore/status exist on the entity, but nothing writes to them). Score
// edits are cached locally per tournament here, merged on top of whatever
// the API returns, so scoring + "live" status work today and will sync for
// real the moment the backend adds a score endpoint (src/api/tournamentApi.ts
// already tries the real REST call first).
const SCORE_KEY_PREFIX = 'paasxo:tournament:scores:';

export interface TrackedTournament {
  id: number;
  futsalId: number;
  name: string;
  role: 'owner' | 'viewer';
}

export interface MatchOverride {
  teamAScore?: number;
  teamBScore?: number;
  status?: 'SCHEDULED' | 'LIVE' | 'COMPLETED';
}

export const tournamentStorage = {
  async getTracked(): Promise<TrackedTournament[]> {
    try {
      const raw = await AsyncStorage.getItem(TRACKED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async track(entry: TrackedTournament): Promise<void> {
    const list = await tournamentStorage.getTracked();
    const next = [entry, ...list.filter((t) => t.id !== entry.id)];
    await AsyncStorage.setItem(TRACKED_KEY, JSON.stringify(next));
  },

  async untrack(id: number): Promise<void> {
    const list = await tournamentStorage.getTracked();
    await AsyncStorage.setItem(TRACKED_KEY, JSON.stringify(list.filter((t) => t.id !== id)));
  },

  async getMatchOverrides(tournamentId: number | string): Promise<Record<string, MatchOverride>> {
    try {
      const raw = await AsyncStorage.getItem(`${SCORE_KEY_PREFIX}${tournamentId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  async setMatchOverride(
    tournamentId: number | string,
    matchId: number | string,
    override: MatchOverride
  ): Promise<void> {
    const all = await tournamentStorage.getMatchOverrides(tournamentId);
    all[String(matchId)] = { ...all[String(matchId)], ...override };
    await AsyncStorage.setItem(`${SCORE_KEY_PREFIX}${tournamentId}`, JSON.stringify(all));
  },
};
