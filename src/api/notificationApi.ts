import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { InvitationStatus } from './invitationApi';

export type NotificationCategory = 'SOCIAL' | 'GENERAL';

export interface NotificationResponse {
  id: string;
  type: string;
  category: NotificationCategory;
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
  | 'BOOKING_PENDING_VENDOR_APPROVAL'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_REJECTED'
  | 'FOLLOW_REQUEST_RECEIVED'
  | 'FOLLOW_REQUEST_ACCEPTED'
  | 'NEW_FOLLOWER'
  | 'POST_LIKED'
  | 'POST_COMMENTED'
  | 'REEL_LIKED'
  | 'TOURNAMENT_PLAYER_ADDED'
  | 'WALK_RUN_INVITE_RECEIVED'
  | 'WALK_RUN_INVITE_ACCEPTED'
  | 'WALK_RUN_INVITE_DECLINED'
  | 'TRAINER_NEW_SESSION'
  | 'NEARBY_SUGGESTION'
  | 'SESSION_REMINDER'
  | 'MATCH_REMINDER'
  | 'TOURNAMENT_REMINDER'
  | 'VENUE_CLOSED';

export const notificationApi = {
  getAll: async (category?: NotificationCategory): Promise<NotificationResponse[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.NOTIFICATIONS.ALL, { params: { category } });
    return Array.isArray(data) ? data : [];
  },

  getUnreadCount: async (category?: NotificationCategory): Promise<number> => {
    const { data } = await axiosInstance.get(ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT, { params: { category } });
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
