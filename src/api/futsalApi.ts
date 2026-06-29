import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';

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
  }): Promise<any[]> => {
    const { data } = await axiosInstance.get(ENDPOINTS.FUTSAL.FILTER, { params });
    return Array.isArray(data) ? data : [];
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
