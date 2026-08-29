import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';

// Normalizes the backend's PagedResponse<T> ({content, page, hasMore}) shape,
// falling back gracefully if an older/unpaginated endpoint returns a raw array.
// Mirrors futsalApi.ts / bookingApi.ts's normalizePage() convention.
function normalizePage(data: any): { content: any[]; hasMore: boolean } {
  if (Array.isArray(data)) return { content: data, hasMore: false };
  const content = Array.isArray(data?.content) ? data.content : [];
  return { content, hasMore: !!data?.hasMore };
}

export const trainerApi = {
  filterTrainers: async (params: {
    query?: string;
    category?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    page?: number;
    size?: number;
  }): Promise<{ content: any[]; hasMore: boolean }> => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.FILTER, { params });
    return normalizePage(data);
  },

  getById: async (trainerId: string | number) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.DETAIL(trainerId));
    return data;
  },

  getSessionsForTrainer: async (trainerFirebaseUid: string) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.SESSIONS_FOR_TRAINER(trainerFirebaseUid));
    return data;
  },

  getSessionById: async (sessionId: string | number) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.SESSION_DETAIL(sessionId));
    return data;
  },

  getSlots: async (sessionId: string | number, from?: string, to?: string) => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.SESSION_SLOTS(sessionId), {
      params: { from, to },
    });
    return data;
  },

  joinSlot: async (slotId: string | number) => {
    const { data } = await axiosInstance.post(ENDPOINTS.TRAINER.JOIN_SLOT(slotId));
    return data;
  },

  getMyBookings: async () => {
    const { data } = await axiosInstance.get(ENDPOINTS.TRAINER.MY_BOOKINGS);
    return data;
  },

  cancelBooking: async (bookingId: string | number) => {
    const { data } = await axiosInstance.patch(ENDPOINTS.TRAINER.CANCEL_BOOKING(bookingId));
    return data;
  },
};
