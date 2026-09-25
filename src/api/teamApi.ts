import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { ChallengeStatus, CreateTeamPayload, SendChallengePayload, Team, TeamChallenge } from '../types/api';

// Thin wrapper around com.pasxo.controller.TeamController / ChallengeController
// - same conventions as tournamentApi.ts / socialMediaApi.ts (no pagination
// here, the backend returns plain lists for every Team endpoint).
export const teamApi = {
  // Multipart, same pattern as socialMediaApi.createPost - a JSON "request"
  // part plus an optional "logo" file part (see TeamController#createTeam).
  createTeam: async (payload: CreateTeamPayload): Promise<Team> => {
    const formData = new FormData();
    formData.append('request', JSON.stringify({
      name: payload.name,
      sport: payload.sport,
      logoUrl: payload.logoUrl,
    }));
    if (payload.logo) {
      formData.append('logo', {
        uri: payload.logo.uri,
        name: payload.logo.name || 'team-logo.jpg',
        type: payload.logo.type || 'image/jpeg',
      } as any);
    }

    const { data } = await axiosInstance.post(ENDPOINTS.TEAMS.CREATE, formData, {
      // No explicit Content-Type - see socialMediaApi.ts's createPost for why
      // setting a boundary-less "multipart/form-data" here breaks uploads.
      timeout: 60000,
    });
    return data;
  },

  getTeam: async (id: string): Promise<Team> => {
    const { data } = await axiosInstance.get(ENDPOINTS.TEAMS.DETAIL(id));
    return data;
  },

  getMyTeams: async (): Promise<Team[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.TEAMS.MINE);
    return Array.isArray(data) ? data : [];
  },

  getTeamsForUser: async (uid: string): Promise<Team[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.TEAMS.FOR_USER(uid));
    return Array.isArray(data) ? data : [];
  },

  searchTeams: async (query: string): Promise<Team[]> => {
    if (!query.trim()) return [];
    const { data } = await axiosInstance.get(ENDPOINTS.TEAMS.SEARCH(query.trim()));
    return Array.isArray(data) ? data : [];
  },

  addMember: async (teamId: string, memberFirebaseUid: string): Promise<Team> => {
    const { data } = await axiosInstance.post(ENDPOINTS.TEAMS.ADD_MEMBER(teamId), { memberFirebaseUid });
    return data;
  },

  removeMember: async (teamId: string, memberFirebaseUid: string): Promise<Team> => {
    const { data } = await axiosInstance.delete(ENDPOINTS.TEAMS.REMOVE_MEMBER(teamId, memberFirebaseUid));
    return data;
  },

  deleteTeam: async (teamId: string): Promise<void> => {
    await axiosInstance.delete(ENDPOINTS.TEAMS.DELETE(teamId));
  },

  // challengedTeamId is the team being challenged; the challenger's own team
  // id is sent in the body (see TeamController#challengeTeam) since the
  // caller may captain more than one team.
  sendChallenge: async (challengedTeamId: string, payload: SendChallengePayload): Promise<TeamChallenge> => {
    const { data } = await axiosInstance.post(ENDPOINTS.TEAMS.CHALLENGE(challengedTeamId), payload);
    return data;
  },

  getChallengesForTeam: async (teamId: string): Promise<TeamChallenge[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.TEAMS.CHALLENGES_FOR_TEAM(teamId));
    return Array.isArray(data) ? data : [];
  },

  respondToChallenge: async (challengeId: string, accept: boolean): Promise<TeamChallenge> => {
    const { data } = await axiosInstance.post(ENDPOINTS.TEAMS.RESPOND_TO_CHALLENGE(challengeId), { accept });
    return data;
  },
};

export type { Team, TeamChallenge, ChallengeStatus };
