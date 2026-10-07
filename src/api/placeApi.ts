import axiosInstance from './axios';
import { ENDPOINTS } from './endpoints';

export interface PlaceSuggestion {
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

export const placeApi = {
  /** Search-by-name location lookup (e.g. "Shalika Ground") for picking a
   *  Public Match's location — backed by the server's free Nominatim proxy
   *  (see PlaceSearchService), which caches results server-side. Returns an
   *  empty list on any failure rather than throwing, since this is an
   *  optional convenience on top of the map pin-drop, never a hard
   *  dependency for creating a match. */
  search: async (query: string): Promise<PlaceSuggestion[]> => {
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.PLACES.SEARCH, { params: { q: query } });
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
};
