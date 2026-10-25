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

  /** Story location sticker: Paasxo venues first, then Google/OSM places near
   *  the user (cached and rate-limited server-side). Never throws. */
  storySearch: async (query: string, coords?: { latitude: number; longitude: number } | null): Promise<StoryPlace[]> => {
    try {
      const { data } = await axiosInstance.get('/places/story-search', {
        params: { q: query, lat: coords?.latitude, lng: coords?.longitude },
        timeout: 8000,
      });
      return Array.isArray(data) ? data.filter((p) => p && typeof p.name === 'string' && p.name.trim()) : [];
    } catch {
      return [];
    }
  },
};

export interface StoryPlace {
  name: string;
  address?: string | null;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source: 'PAASXO' | 'GOOGLE' | 'OSM';
}
