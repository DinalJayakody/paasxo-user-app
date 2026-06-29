import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';

export interface InvitationResponse {
  id: string;
  bookingId: number;
  senderFirebaseUid: string;
  recipientFirebaseUid: string;
  status: InvitationStatus;
  directAdd: boolean;
  createdAt: string;
  expiresAt?: string;
  message?: string;
}

export interface AcceptInvitationResponse {
  invitationId: string;
  status: InvitationStatus;
  requiresPayment: boolean;
  amountDue?: number;
  bookingId: number;
  message: string;
}

export type InvitationStatus =
  | 'REQUEST_SENT'
  | 'VIEWED'
  | 'ACCEPTED_AWAITING_PAYMENT'
  | 'PAYMENT_IN_PROGRESS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_COMPLETED'
  | 'JOIN_COMPLETED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'MATCH_FULL'
  | 'MATCH_CANCELLED'
  | 'AUTO_CANCELLED';

export const invitationApi = {
  /**
   * Organizer/existing player invites a searched player.
   * The searched player (recipientFirebaseUid) receives a notification and must accept.
   */
  invite: async (bookingId: string | number, recipientFirebaseUid: string): Promise<InvitationResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.INVITATIONS.INVITE, {
      bookingId: Number(bookingId),
      recipientFirebaseUid,
    });
    return data;
  },

  /**
   * Player requests to join someone else's match.
   * The organizer (recipientFirebaseUid) receives a notification and must approve.
   */
  sendRequest: async (bookingId: string | number, recipientFirebaseUid: string): Promise<InvitationResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.INVITATIONS.REQUEST, {
      bookingId: Number(bookingId),
      recipientFirebaseUid,
    });
    return data;
  },

  directAdd: async (bookingId: string | number, recipientFirebaseUid: string): Promise<InvitationResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.INVITATIONS.DIRECT_ADD, {
      bookingId: Number(bookingId),
      recipientFirebaseUid,
    });
    return data;
  },

  accept: async (invitationId: string): Promise<AcceptInvitationResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.INVITATIONS.ACCEPT(invitationId));
    return data;
  },

  decline: async (invitationId: string): Promise<InvitationResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.INVITATIONS.DECLINE(invitationId));
    return data;
  },

  completePayment: async (invitationId: string, paymentReference = 'SIMULATED'): Promise<AcceptInvitationResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.INVITATIONS.COMPLETE_PAYMENT(invitationId), {
      paymentReference,
    });
    return data;
  },

  getReceived: async (): Promise<InvitationResponse[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.INVITATIONS.RECEIVED);
    return Array.isArray(data) ? data : [];
  },
};
