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

/**
 * Resolves any shape a profile picture can arrive in - a full URL (R2 or
 * otherwise), a relative backend path (locally-stored uploads), a raw
 * base64 string, an { uri } object from ImagePicker, or nothing at all -
 * into a URI <Image> can load, falling back to a generated avatar seeded by
 * the user's display name. This is the single source of truth for avatar
 * resolution across the app; every screen/component that renders a user's
 * profile picture should go through this instead of reimplementing it.
 */
export function resolveAvatarUri(raw: unknown, fallbackSeed?: string | null): string {
  const fallback = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
    fallbackSeed || 'P'
  )}&backgroundColor=2977c2&textColor=ffffff`;

  if (!raw) return fallback;

  // Object shape { uri: string } (from ImagePicker or EditProfile)
  if (typeof raw === 'object' && 'uri' in (raw as any)) {
    return (raw as { uri?: string }).uri || fallback;
  }
  if (typeof raw !== 'string' || !raw.trim()) return fallback;

  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:') || raw.startsWith('file://')) {
    return raw;
  }
  if (raw.startsWith('/')) {
    return resolveMediaUrl(raw) as string;
  }
  // Assume raw base64 string
  return `data:image/jpeg;base64,${raw}`;
}
