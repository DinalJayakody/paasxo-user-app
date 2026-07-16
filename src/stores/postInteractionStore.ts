import { useEffect, useSyncExternalStore } from 'react';
import { PostSummary } from '../types/api';

// Single in-memory source of truth for like/comment/save state, shared by
// every screen a post can render on (Feed, my Profile, a friend's Profile).
// Without this, liking a post in the Feed would never be reflected if the
// same post is later opened from a Profile grid, and vice versa.
//
// Built on useSyncExternalStore rather than React Context so each PostCard
// only re-renders when *its own* post's snapshot actually changes - a Context
// holding the whole map would re-render every mounted PostCard on any single
// post's like, which matters here since a Feed screen + a Profile grid can
// easily have dozens of PostCards mounted at once.

export interface PostInteractionState {
  likeCount: number;
  likedByCurrentUser: boolean;
  commentCount: number;
  savedByCurrentUser: boolean;
}

type Listener = () => void;

const state = new Map<string, PostInteractionState>();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function toState(post: Pick<PostSummary, 'likeCount' | 'likedByCurrentUser' | 'commentCount' | 'savedByCurrentUser'>): PostInteractionState {
  return {
    likeCount: post.likeCount,
    likedByCurrentUser: post.likedByCurrentUser,
    commentCount: post.commentCount,
    savedByCurrentUser: post.savedByCurrentUser,
  };
}

export const postInteractionStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(postId: string): PostInteractionState | undefined {
    return state.get(postId);
  },

  // Seeds the store the first time a post is seen from any list fetch. Once a
  // postId is known, the store is the source of truth - a later re-fetch of
  // the same list (e.g. pull-to-refresh) does NOT clobber it, so an in-flight
  // optimistic toggle never gets stomped by a stale re-render.
  hydrateIfAbsent(postId: string, post: Pick<PostSummary, 'likeCount' | 'likedByCurrentUser' | 'commentCount' | 'savedByCurrentUser'>) {
    if (state.has(postId)) return;
    state.set(postId, toState(post));
    emit();
  },

  applyLike(postId: string, patch: { likeCount: number; likedByCurrentUser: boolean }) {
    const prev = state.get(postId);
    state.set(postId, { ...(prev ?? DEFAULT), ...patch });
    emit();
  },

  applySave(postId: string, patch: { savedByCurrentUser: boolean }) {
    const prev = state.get(postId);
    state.set(postId, { ...(prev ?? DEFAULT), ...patch });
    emit();
  },

  incrementComments(postId: string) {
    const prev = state.get(postId) ?? DEFAULT;
    state.set(postId, { ...prev, commentCount: prev.commentCount + 1 });
    emit();
  },
};

const DEFAULT: PostInteractionState = {
  likeCount: 0,
  likedByCurrentUser: false,
  commentCount: 0,
  savedByCurrentUser: false,
};

/**
 * Live like/comment/save state for one post, seeded from `post` on first
 * render and kept in sync with any toggle made from anywhere else in the app.
 */
export function usePostInteraction(post: PostSummary): PostInteractionState {
  // Hydration happens post-render (not during it) so this never triggers a
  // setState-on-another-component-mid-render warning from useSyncExternalStore
  // consumers elsewhere on screen. The getSnapshot fallback below covers the
  // brief window before this effect runs.
  useEffect(() => {
    postInteractionStore.hydrateIfAbsent(post.id, post);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  return useSyncExternalStore(
    postInteractionStore.subscribe,
    () => postInteractionStore.getSnapshot(post.id) ?? toState(post)
  );
}
