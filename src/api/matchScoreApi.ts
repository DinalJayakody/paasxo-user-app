import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { MatchScoreState } from '../types/api';

export const matchScoreApi = {
  getScore: async (bookingId: string | number): Promise<MatchScoreState> => {
    const { data } = await axiosInstance.get(ENDPOINTS.MATCH_SCORE.GET(bookingId));
    return data;
  },

  startMatch: async (bookingId: string | number): Promise<MatchScoreState> => {
    const { data } = await axiosInstance.post(ENDPOINTS.MATCH_SCORE.START(bookingId));
    return data;
  },

  pauseTimer: async (bookingId: string | number): Promise<MatchScoreState> => {
    const { data } = await axiosInstance.post(ENDPOINTS.MATCH_SCORE.PAUSE(bookingId));
    return data;
  },

  resumeTimer: async (bookingId: string | number): Promise<MatchScoreState> => {
    const { data } = await axiosInstance.post(ENDPOINTS.MATCH_SCORE.RESUME(bookingId));
    return data;
  },

  endMatch: async (bookingId: string | number): Promise<MatchScoreState> => {
    const { data } = await axiosInstance.post(ENDPOINTS.MATCH_SCORE.END(bookingId));
    return data;
  },

  resetMatch: async (bookingId: string | number): Promise<MatchScoreState> => {
    const { data } = await axiosInstance.post(ENDPOINTS.MATCH_SCORE.RESET(bookingId));
    return data;
  },

  updateState: async (
    bookingId: string | number,
    payload: { teamAScore?: number; teamBScore?: number; state?: Record<string, any> }
  ): Promise<MatchScoreState> => {
    const { data } = await axiosInstance.put(ENDPOINTS.MATCH_SCORE.UPDATE_STATE(bookingId), payload);
    return data;
  },
};
