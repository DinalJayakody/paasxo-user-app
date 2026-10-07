import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { MatchScoreEvent, MatchScorecard, MatchScoreState } from '../types/api';

export interface RecordEventPayload {
  teamLabel: 'A' | 'B';
  eventType: string;
  playerId?: number | null;
  minute?: number;
  inningsNumber?: number;
  runs?: number;
  isWicket?: boolean;
  wicketType?: string;
  extraType?: string;
  bowlerId?: number | null;
}

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

  getEvents: async (bookingId: string | number): Promise<MatchScoreEvent[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.MATCH_SCORE.EVENTS(bookingId));
    return data;
  },

  recordEvent: async (bookingId: string | number, payload: RecordEventPayload): Promise<MatchScoreEvent> => {
    const { data } = await axiosInstance.post(ENDPOINTS.MATCH_SCORE.EVENTS(bookingId), payload);
    return data;
  },

  undoLastEvent: async (bookingId: string | number): Promise<MatchScoreEvent> => {
    const { data } = await axiosInstance.delete(ENDPOINTS.MATCH_SCORE.UNDO_LAST_EVENT(bookingId));
    return data;
  },

  // The "complete, live scorecard" — rosters, full event log, and server-computed
  // per-sport aggregates (not just the two final score numbers).
  getScorecard: async (bookingId: string | number): Promise<MatchScorecard> => {
    const { data } = await axiosInstance.get(ENDPOINTS.MATCH_SCORE.SCORECARD(bookingId));
    return data;
  },
};
