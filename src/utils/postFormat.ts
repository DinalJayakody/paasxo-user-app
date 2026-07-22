import { resolveMediaUrl } from './mediaUrl';

// Shared by every place a post/comment/avatar renders (PostCard, ReelGrid,
// PostGrid, ReelPlayer, CommentSheet). Thin re-export of resolveMediaUrl so
// relative backend paths (locally-stored uploads) resolve correctly too,
// not just absolute/data URIs - this used to mishandle those as raw base64.
export function parseMediaUrl(url?: string): string | undefined {
  return resolveMediaUrl(url);
}

export function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Just now';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
