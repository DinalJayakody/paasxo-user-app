import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';

export interface VendorBooking {
  id: number;
  uuid: string;
  bookingReference: string;
  customerName: string;
  customerFirebaseUid?: string;
  venueName: string;
  courtName?: string;
  sport?: string;
  title?: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  amount?: number;
  maxPlayers?: number;
  minPlayers?: number;
  joinedPlayersCount?: number;
  players?: string[];
  status: string;
  vendorStatus?: 'PENDING_VENDOR' | 'ACTIVE_MATCH' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
}

export interface VendorNotification {
  id: number;
  uuid: string;
  type: 'BOOKING_REQUEST' | 'BOOKING_CANCELLED' | 'PLAYER_JOINED' | 'BOOKING_APPROVED' | 'BOOKING_REJECTED';
  bookingId?: number;
  venueId?: number;
  title: string;
  body: string;
  notifRead: boolean;
  customerName?: string;
  customerFirebaseUid?: string;
  venueName?: string;
  matchTitle?: string;
  bookingDate?: string;
  startTime?: string;
  endTime?: string;
  amount?: number;
  maxPlayers?: number;
  minPlayers?: number;
  createdAt: string;
}

const extractList = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.bookings)) return data.bookings;
  if (data?.booking) return [data.booking];
  if (data?.id || data?._id) return [data];
  return [];
};

export const vendorApi = {
  // GET /vendor/bookings/pending — all bookings awaiting vendor acceptance for this venue
  getPendingBookings: async (): Promise<VendorBooking[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.VENDOR.PENDING_BOOKINGS);
    return extractList(data);
  },

  // GET /vendor/bookings — all bookings (pending + active + historical) for this venue
  getVendorBookings: async (): Promise<VendorBooking[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.VENDOR.MY_VENUE_BOOKINGS);
    return extractList(data);
  },

  // PUT /vendor/bookings/{id}/accept — accept a booking request
  // On success: booking status → ACTIVE_MATCH, match becomes visible in public feed.
  // The organizer and joined players receive push notifications.
  acceptBooking: async (id: string | number): Promise<VendorBooking> => {
    const { data } = await axiosInstance.put(ENDPOINTS.VENDOR.ACCEPT(id));
    return data?.data ?? data?.booking ?? data;
  },

  // PUT /vendor/bookings/{id}/reject — reject a booking request
  // On success: booking status → CANCELLED, organizer payment is refunded.
  rejectBooking: async (id: string | number, reason?: string): Promise<void> => {
    await axiosInstance.put(ENDPOINTS.VENDOR.REJECT(id), reason ? { reason } : undefined);
  },

  // GET /vendor/notifications — vendor-side notification feed
  getNotifications: async (): Promise<VendorNotification[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.VENDOR.NOTIFICATIONS);
    return extractList(data);
  },

  // GET /vendor/notifications/unread-count
  getUnreadCount: async (): Promise<number> => {
    const { data } = await axiosInstance.get(ENDPOINTS.VENDOR.NOTIFICATION_UNREAD_COUNT);
    return data?.data ?? 0;
  },

  // PUT /vendor/notifications/{id}/read — mark a single notification as read
  markNotificationRead: async (id: string | number): Promise<void> => {
    await axiosInstance.put(ENDPOINTS.VENDOR.MARK_NOTIFICATION_READ(id));
  },

  // PUT /vendor/notifications/read-all — mark all vendor notifications as read
  markAllNotificationsRead: async (): Promise<void> => {
    await axiosInstance.put(ENDPOINTS.VENDOR.MARK_ALL_READ);
  },
};
