import { ENDPOINTS } from '../api/endpoints';

/**
 * Converts a server-returned mediaUrl into a full URL the device can load.
 *
 * The backend stores `/uploads/stories/uuid.jpg` (relative path).
 * We prepend the API base URL so the device can fetch it from the right host:
 *   iOS sim   → http://localhost:8080/api/uploads/stories/uuid.jpg
 *   Android   → http://10.0.2.2:8080/api/uploads/stories/uuid.jpg
 *   Tunnel    → https://xxx.trycloudflare.com/api/uploads/stories/uuid.jpg
 *
 * If the stored URL already starts with http(s) or data:, it is returned as-is.
 */
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('file://')
  ) {
    return url;
  }
  const base = ENDPOINTS.BASE_URL.replace(/\/$/, ''); // e.g. http://localhost:8080/api
  const path = url.startsWith('/') ? url : `/${url}`;
  return base + path;
}
