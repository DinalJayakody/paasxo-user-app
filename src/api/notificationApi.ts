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
  | 'POST_TAGGED'
  | 'STORY_TAGGED'
  | 'TOURNAMENT_PLAYER_ADDED'
  | 'WALK_RUN_INVITE_RECEIVED'
  | 'WALK_RUN_INVITE_ACCEPTED'
  | 'WALK_RUN_INVITE_DECLINED'
  | 'TRAINER_NEW_SESSION'
  | 'TRAINER_PLAN_PERSONAL'
  | 'NEARBY_SUGGESTION'
  | 'SESSION_REMINDER'
  | 'MATCH_REMINDER'
  | 'TOURNAMENT_REMINDER'
  | 'VENUE_CLOSED'
  | 'TEAM_CHALLENGE_RECEIVED'
  | 'TEAM_MEMBER_LEFT'
  | 'TEAM_CAPTAIN_ASSIGNED'
  | 'TEAM_CHALLENGE_ACCEPTED'
  | 'TEAM_CHALLENGE_DECLINED';

/** Notification types the GENERAL (match & booking) centre shows and badges count. */
export const GENERAL_BADGE_TYPES = new Set<string>([
  'INVITATION_RECEIVED',
  'INVITATION_ACCEPTED',
  'INVITATION_DECLINED',
  'INVITATION_EXPIRED',
  'PAYMENT_REQUIRED',
  'PAYMENT_SUCCESSFUL',
  'PLAYER_JOINED',
  'PLAYER_ADDED_DIRECTLY',
  'MATCH_CANCELLED_NOTIFY',
  'BOOKING_PENDING_VENDOR_APPROVAL',
  'BOOKING_CONFIRMED',
  'BOOKING_REJECTED',
  'MATCH_REMINDER',
  'VENUE_CLOSED',
  // Tournament invitations need the captain's answer, so they're listed here too.
  'TOURNAMENT_TEAM_INVITED',
  'TOURNAMENT_TEAM_JOINED',
]);

export const notificationApi = {
  getAll: async (category?: NotificationCategory): Promise<NotificationResponse[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.NOTIFICATIONS.ALL, { params: { category } });
    return Array.isArray(data) ? data : [];
  },

  // GENERAL badges count only the types the GENERAL screen lists.
  getUnreadCount: async (category?: NotificationCategory): Promise<number> => {
    const types = category === 'GENERAL' ? [...GENERAL_BADGE_TYPES].join(',') : undefined;
    const { data } = await axiosInstance.get(ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT, { params: { category, types } });
    return data?.count ?? 0;
  },

  markRead: async (id: string): Promise<NotificationResponse> => {
    const { data } = await axiosInstance.post(ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
    return data;
  },

  /**
   * One request: marks unread notifications read — optionally just one
   * category, and only up to `upTo` (the newest createdAt the user saw), so
   * one that arrives while the screen is open stays unread.
   */
  markAllRead: async (category?: NotificationCategory, upTo?: string): Promise<void> => {
    await axiosInstance.post(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ, null, { params: { category, upTo } });
  },

  /** Registers this device's raw APNs token — see ApnsPushService on the backend. */
  registerPushToken: async (token: string): Promise<void> => {
    await axiosInstance.post(ENDPOINTS.NOTIFICATIONS.PUSH_TOKEN, { token });
  },

  /** Called on sign-out so a signed-out device stops receiving this account's pushes. */
  unregisterPushToken: async (token: string): Promise<void> => {
    await axiosInstance.delete(ENDPOINTS.NOTIFICATIONS.PUSH_TOKEN, { data: { token } });
  },
};
