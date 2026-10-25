import { resolveMediaUrl } from './mediaUrl';
import { serverTimeMs } from './serverTime';

// Shared by every place a post/comment/avatar renders (PostCard, ReelGrid,
// PostGrid, ReelPlayer, CommentSheet). Thin re-export of resolveMediaUrl so
// relative backend paths (locally-stored uploads) resolve correctly too,
// not just absolute/data URIs - this used to mishandle those as raw base64.
export function parseMediaUrl(url?: string): string | undefined {
  return resolveMediaUrl(url);
}

// Server timestamps are UTC without a zone marker; `new Date(str)` read them as
// LOCAL time, which in Sri Lanka (UTC+5:30) put every new post 5½ hours in the
// future — so it said "Just now" for 5½ hours. serverTimeMs reads them as UTC.
export function formatTimeAgo(dateString?: string): string {
  const t = serverTimeMs(dateString);
  if (!t) return 'Just now';
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
