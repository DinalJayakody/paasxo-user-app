// Standalone GIPHY client for GIF comments - deliberately NOT using the app's
// shared `axiosInstance`, since that's hard-wired to the Paasxo backend host
// and carries a Firebase-JWT auth interceptor that must never be sent to a
// third-party host.
//
// Using GIPHY's public beta key for now (shared, rate-limited, dev-only per
// GIPHY's terms) - swap for a real key from developers.giphy.com before
// shipping to real traffic.
const GIPHY_API_KEY = 'dc6zaTOxFJmzC';
const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';

export interface GifResult {
  id: string;
  previewUrl: string; // small, for the picker grid
  url: string; // full-size, sent as the comment's gifUrl
}

function mapGifs(data: any[]): GifResult[] {
  return (Array.isArray(data) ? data : []).map((g) => ({
    id: g.id,
    previewUrl: g.images?.fixed_width_small?.url ?? g.images?.fixed_width?.url ?? g.images?.original?.url,
    url: g.images?.fixed_width?.url ?? g.images?.original?.url,
  }));
}

async function fetchGifs(url: string): Promise<GifResult[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GIPHY request failed: ${res.status}`);
  const json = await res.json();
  return mapGifs(json.data);
}

export const giphyApi = {
  searchGifs: (query: string, offset: number = 0, limit: number = 24) =>
    fetchGifs(
      `${GIPHY_BASE_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&rating=pg-13`
    ),

  getTrendingGifs: (offset: number = 0, limit: number = 24) =>
    fetchGifs(`${GIPHY_BASE_URL}/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&offset=${offset}&rating=pg-13`),
};
