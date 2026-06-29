import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import {
  CreateTournamentPayload,
  CreateTournamentTeamPayload,
  AddTournamentPlayerPayload,
  CreateTournamentMatchPayload,
} from '../types/api';

export const tournamentApi = {
  createTournament: async (futsalId: string | number, payload: CreateTournamentPayload) => {
    const { data } = await axiosInstance.post(ENDPOINTS.TOURNAMENTS.CREATE(futsalId), payload);
    return data;
  },

  listForFutsal: async (futsalId: string | number) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TOURNAMENTS.LIST_FOR_FUTSAL(futsalId));
    return Array.isArray(data) ? data : [];
  },

  getTournament: async (tournamentId: string | number) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TOURNAMENTS.DETAIL(tournamentId));
    return data;
  },

  createTeam: async (tournamentId: string | number, payload: CreateTournamentTeamPayload) => {
    const { data } = await axiosInstance.post(ENDPOINTS.TOURNAMENTS.CREATE_TEAM(tournamentId), payload);
    return data;
  },

  listTeams: async (tournamentId: string | number) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TOURNAMENTS.LIST_TEAMS(tournamentId));
    return Array.isArray(data) ? data : [];
  },

  addPlayer: async (
    tournamentId: string | number,
    teamId: string | number,
    payload: AddTournamentPlayerPayload
  ) => {
    const { data } = await axiosInstance.post(
      ENDPOINTS.TOURNAMENTS.ADD_PLAYER(tournamentId, teamId),
      payload
    );
    return data;
  },

  listPlayers: async (tournamentId: string | number, teamId: string | number) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TOURNAMENTS.LIST_PLAYERS(tournamentId, teamId));
    return Array.isArray(data) ? data : [];
  },

  createMatch: async (tournamentId: string | number, payload: CreateTournamentMatchPayload) => {
    const { data } = await axiosInstance.post(ENDPOINTS.TOURNAMENTS.CREATE_MATCH(tournamentId), payload);
    return data;
  },

  listMatches: async (tournamentId: string | number) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TOURNAMENTS.LIST_MATCHES(tournamentId));
    return Array.isArray(data) ? data : [];
  },

  // Speculative - there is no score endpoint on the backend yet. We try it
  // anyway so this starts working for real the moment it's added; the
  // caller (MatchScoringScreen) always also writes to the local override
  // cache so scoring works today regardless of whether this call succeeds.
  updateScore: async (
    tournamentId: string | number,
    matchId: string | number,
    payload: { teamAScore: number; teamBScore: number; status?: string }
  ) => {
    const { data } = await axiosInstance.patch(
      ENDPOINTS.TOURNAMENTS.UPDATE_SCORE(tournamentId, matchId),
      payload
    );
    return data;
  },
};
