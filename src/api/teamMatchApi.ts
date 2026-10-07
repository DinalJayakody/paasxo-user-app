import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { Team, TeamMatchChallenge } from '../types/api';

// Real, bookable Team-vs-Team matches — thin client over
// com.pasxo.controller.TeamMatchController, same conventions as teamApi.ts.
// Distinct from teamApi.ts's sendChallenge/respondToChallenge (the purely
// social, non-monetary challenge feature).
export const teamMatchApi = {
  // Creates the organizer's leg of a Team Match Challenge: same venue/slot
  // payload shape as a normal match (see CreateBookingPayload), plus which
  // of the caller's teams is organizing. Returns a raw booking object — pass
  // through parseMatchDetails if the typed MatchDetails shape is needed.
  createTeamMatchBooking: async (payload: {
    organizerTeamId: string;
    futsalId: number;
    slotId?: number;
    slotIds?: number[];
    title?: string;
    description?: string;
    sport?: string;
    date?: string;
  }): Promise<any> => {
    const { data } = await axiosInstance.post(ENDPOINTS.TEAM_MATCHES.CREATE, payload);
    return data;
  },

  // Teams within radiusKm (default 20, server-side) of the booking's venue,
  // excluding the organizer's own team. Only teams with a captured location
  // appear here — search by name (teamApi.searchTeams) isn't distance-bound.
  getNearbyTeams: async (bookingId: string | number, radiusKm?: number): Promise<Team[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.TEAM_MATCHES.NEARBY_TEAMS(bookingId, radiusKm));
    return Array.isArray(data) ? data : [];
  },

  sendChallenge: async (bookingId: string | number, challengedTeamId: string): Promise<TeamMatchChallenge> => {
    const { data } = await axiosInstance.post(ENDPOINTS.TEAM_MATCHES.CHALLENGE(bookingId), { challengedTeamId });
    return data;
  },

  declineChallenge: async (challengeId: string): Promise<void> => {
    await axiosInstance.post(ENDPOINTS.TEAM_MATCHES.DECLINE_CHALLENGE(challengeId));
  },

  // Creates the payment-engine bridge order for the challenged captain's half
  // payment — paymentOrderId feeds straight into
  // paymentApi.initiateCheckout('TEAM_CHALLENGE_ACCEPT', paymentOrderId).
  createAcceptOrder: async (challengeId: string): Promise<{ paymentOrderId: number; amountDue: number }> => {
    const { data } = await axiosInstance.post(ENDPOINTS.TEAM_MATCHES.ACCEPT_ORDER(challengeId));
    return data;
  },

  // Pending (PENDING_PAYMENT) challenges where the caller captains the
  // challenged team, across every team they captain — powers the Profile
  // "Teams" tab's Match Challenges card.
  getMyPendingChallenges: async (): Promise<TeamMatchChallenge[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.TEAM_MATCHES.MY_PENDING_CHALLENGES);
    return Array.isArray(data) ? data : [];
  },
};

export default teamMatchApi;
