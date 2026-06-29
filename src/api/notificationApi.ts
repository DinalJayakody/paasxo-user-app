import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { InvitationStatus } from './invitationApi';

export interface NotificationResponse {
  id: string;
  type: string;
  invitationId?: string;
  bookingId?: number;
  title: string;
  body: string;
  matchSnapshot?: Record<string, any>;
  read: boolean;
  createdAt: string;
  invitationStatus?: InvitationStatus;
}

export type NotificationType =
  | 'INVITATION_RECEIVED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_DECLINED'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_SUCCESSFUL'
  | 'PLAYER_JOINED'
  | 'PLAYER_ADDED_DIRECTLY'
  | 'INVITATION_EXPIRED'
  | 'MATCH_CANCELLED_NOTIFY'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_REJECTED';

export const notificationApi = {
  getAll: async (): Promise<NotificationResponse[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.NOTIFICATIONS.ALL);
    return Array.isArray(data) ? data : [];
  },

  getUnreadCount: async (): Promise<number> => {
    const { data } = await axiosInstance.get(ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT);
    return data?.count ?? 0;
  },

  markRead: async (id: string): Promise<NotificationResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
    return data;
  },

  markAllRead: async (): Promise<void> => {
    await axiosInstance.post(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
  },
};
