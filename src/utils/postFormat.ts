// Shared by every place a post/comment/avatar renders (PostCard, ProfileScreen,
// FriendProfileScreen, CommentSheet) - previously duplicated near-identically
// in PostCard.tsx and ProfileScreen.tsx.

export function parseMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('file') || url.startsWith('data:')) return url;
  return `data:image/jpeg;base64,${url}`;
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
