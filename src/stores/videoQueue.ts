import { PostSummary } from '../types/api';

/**
 * The video posts currently loaded in the feed, in feed order — lets a
 * tapped video post open a Reels-style pager that keeps going through the
 * other videos without another network call. Purely in-memory.
 */
let queue: PostSummary[] = [];

export const videoQueue = {
  set(posts: PostSummary[]) {
    queue = posts.filter((p) => p.mediaType === 'VIDEO' && !!p.mediaUrl).slice(0, 60);
  },
  /** The queue positioned at `post`, or just that post if it isn't in it. */
  around(post: PostSummary): { items: PostSummary[]; index: number } {
    const i = queue.findIndex((p) => p.id === post.id);
    return i < 0 ? { items: [post], index: 0 } : { items: queue, index: i };
  },
};
