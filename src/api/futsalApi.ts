import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';

// Normalizes the backend's PagedResponse<T> ({content, page, hasMore}) shape,
// falling back gracefully if an older/unpaginated endpoint returns a raw array.
function normalizePage(data: any): { content: any[]; hasMore: boolean } {
  if (Array.isArray(data)) return { content: data, hasMore: false };
  const content = Array.isArray(data?.content) ? data.content : [];
  return { content, hasMore: !!data?.hasMore };
}

export const futsalApi = {
  listVenues: async () => {
    const { data } = await axiosInstance.get(ENDPOINTS.FUTSAL.LIST);
    return data;
  },

  filterVenues: async (params: {
    query?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    freeOnly?: boolean;
    sport?: string;
    page?: number;
    size?: number;
  }): Promise<{ content: any[]; hasMore: boolean }> => {
    const { data } = await axiosInstance.get(ENDPOINTS.FUTSAL.FILTER, { params });
    return normalizePage(data);
  },

  getById: async (futsalId: string | number) => {
    const { data } = await axiosInstance.get(ENDPOINTS.FUTSAL.DETAIL(futsalId));
    return data;
  },

  getSlots: async (futsalId: string | number, date: string) => {
    const { data } = await axiosInstance.get(
      ENDPOINTS.FUTSAL.SLOTS(futsalId, date)
    );
    return data;
  },
};
