import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { MatchTeamPlayer, MatchTeams } from '../types/api';

export const matchTeamApi = {
  getTeams: async (bookingId: string | number): Promise<MatchTeams> => {
    const { data } = await axiosInstance.get(ENDPOINTS.MATCH_TEAMS.GET(bookingId));
    return data;
  },

  // Exactly one of playerFirebaseUid (registered user — name/photo resolved
  // server-side) or displayName (custom/unregistered participant) is expected.
  addPlayer: async (
    bookingId: string | number,
    teamLabel: 'A' | 'B',
    player: { playerFirebaseUid?: string; displayName?: string }
  ): Promise<MatchTeamPlayer> => {
    const { data } = await axiosInstance.post(ENDPOINTS.MATCH_TEAMS.ADD_PLAYER(bookingId, teamLabel), player);
    return data;
  },

  removePlayer: async (bookingId: string | number, playerId: string | number): Promise<void> => {
    await axiosInstance.delete(ENDPOINTS.MATCH_TEAMS.REMOVE_PLAYER(bookingId, playerId));
  },

  renameTeam: async (bookingId: string | number, teamLabel: 'A' | 'B', name: string): Promise<MatchTeams> => {
    const { data } = await axiosInstance.put(ENDPOINTS.MATCH_TEAMS.RENAME_TEAM(bookingId, teamLabel), { name });
    return data;
  },

  // Quick-setup: wipes any existing roster and evenly alternates every
  // joined player between Team A/B in join order.
  autoSplit: async (bookingId: string | number): Promise<MatchTeams> => {
    const { data } = await axiosInstance.post(ENDPOINTS.MATCH_TEAMS.AUTO_SPLIT(bookingId));
    return data;
  },
};
