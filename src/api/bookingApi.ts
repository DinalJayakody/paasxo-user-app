import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';
import { CreateBookingPayload } from '../types/api';

const extractList = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.bookings)) return data.bookings;
  if (Array.isArray(data?.results)) return data.results;
  if (data?.booking) return [data.booking];
  if (data?.match) return [data.match];
  if (data?.id || data?._id) return [data];
  return [];
};

// Normalizes the backend's PagedResponse<T> ({content, page, hasMore}) shape,
// falling back gracefully if an older/unpaginated endpoint returns a raw array.
function normalizePage(data: any): { content: any[]; hasMore: boolean } {
  if (Array.isArray(data)) return { content: data, hasMore: false };
  const content = Array.isArray(data?.content) ? data.content : [];
  return { content, hasMore: !!data?.hasMore };
}

export const bookingApi = {
  // GET /bookings/my — matches the user organised (userId == me)
  getMyBookings: async () => {
    const { data } = await axiosInstance.get(ENDPOINTS.BOOKINGS.MY);
    return extractList(data);
  },

  // GET /bookings/joined — non-cancelled matches where user is a player but NOT the organizer
  getJoinedBookings: async () => {
    const { data } = await axiosInstance.get(ENDPOINTS.BOOKINGS.JOINED);
    return extractList(data);
  },

  // Try public endpoint first (works for nearby bookings not owned by current user),
  // fall back to own-booking list scan if the backend doesn't have the public route yet.
  getById: async (id: string | number) => {
    try {
      const { data } = await axiosInstance.get(`/bookings/${id}`);
      return data;
    } catch {
      // Fallback: scan own bookings
      const list = await bookingApi.getMyBookings();
      const match = list.find(
        (item) => String(item.id ?? item._id ?? item.bookingId) === String(id)
      );
      if (match) return match;
      // Last resort: scan all bookings (requires /bookings/all)
      try {
        const all = await bookingApi.getAllBookings();
        const found = all.find(
          (item: any) => String(item.id ?? item._id ?? item.bookingId) === String(id)
        );
        if (found) return found;
      } catch { /* ignore */ }
      throw new Error(`Booking with id ${id} was not found`);
    }
  },

  // POST /bookings - creates one booking for one or more consecutive slots.
  // { futsalId, slotIds, title?, maxPlayers?, players? }
  createBooking: async (payload: CreateBookingPayload) => {
    const { data } = await axiosInstance.post(ENDPOINTS.BOOKINGS.CREATE, payload);
    return data;
  },

  // POST /bookings/{id}/players - add player firebaseUids to an existing booking.
  addPlayersToBooking: async (id: string | number, players: string[]) => {
    const { data } = await axiosInstance.post(ENDPOINTS.BOOKINGS.ADD_PLAYERS(id), { players });
    return data;
  },

  // PATCH /bookings/{id}/cancel - the only mutation the backend supports
  // for an existing booking.
  cancelBooking: async (id: string | number) => {
    const { data } = await axiosInstance.patch(ENDPOINTS.BOOKINGS.CANCEL(id));
    return data;
  },

  // GET /bookings/all - all confirmed bookings (public feed for "nearby" view)
  getAllBookings: async () => {
    const { data } = await axiosInstance.get('/bookings/all');
    return extractList(data);
  },

  // GET /bookings/filter — server-side filtered matches (text, sport, date, radius, free-only), paginated
  filterBookings: async (params: {
    query?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    sport?: string;
    date?: string;
    freeOnly?: boolean;
    page?: number;
    size?: number;
  }): Promise<{ content: any[]; hasMore: boolean }> => {
    const { data } = await axiosInstance.get(ENDPOINTS.BOOKINGS.FILTER, { params });
    return normalizePage(data);
  },

  // GET /bookings/nearby?lat=&lng=&radiusKm= - server-filtered by 20km Haversine
  getNearbyBookings: async (lat: number, lng: number, radiusKm = 20) => {
    const { data } = await axiosInstance.get('/bookings/nearby', {
      params: { lat, lng, radiusKm },
    });
    return extractList(data);
  },

  // POST /bookings/{id}/join — join an existing match as a player
  joinMatch: async (id: string | number, additionalPlayerIds: string[] = []) => {
    const { data } = await axiosInstance.post(ENDPOINTS.BOOKINGS.JOIN(id), {
      additionalPlayerIds,
    });
    return data;
  },
};
