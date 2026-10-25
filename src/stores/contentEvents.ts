import { useEffect, useState } from 'react';

/**
 * App-wide "this post/reel/story was deleted" signal, so every list currently
 * showing it (Feed, Profile, a friend's profile, a community, Saved, open
 * players/viewers) drops it immediately — no reload, no stale tile left to tap.
 * Ids are opaque server ids; kept in memory for the session only.
 */
// 'untag': you removed yourself from a post's tags — it leaves your Tagged tab.
export type ContentKind = 'post' | 'reel' | 'story' | 'untag';
type Listener = (kind: ContentKind, id: string) => void;

const deleted: Record<ContentKind, Set<string>> = { post: new Set(), reel: new Set(), story: new Set(), untag: new Set() };
const listeners = new Set<Listener>();

export const contentEvents = {
  markDeleted(kind: ContentKind, id: string) {
    if (!id || deleted[kind].has(id)) return;
    deleted[kind].add(id);
    listeners.forEach((l) => l(kind, id));
  },
  isDeleted(kind: ContentKind, id: string) {
    return deleted[kind].has(id);
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

/** Filters a list by what's been deleted this session; re-renders when something is. */
export function useWithoutDeleted<T>(kind: ContentKind, items: T[], idOf: (item: T) => string): T[] {
  const [version, setVersion] = useState(0);
  useEffect(() => contentEvents.subscribe((k) => { if (k === kind) setVersion((v) => v + 1); }), [kind]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void version;
  return items.filter((item) => !contentEvents.isDeleted(kind, idOf(item)));
}

/** True once this one item was deleted this session (components hide themselves). */
export function useIsDeleted(kind: ContentKind, id: string): boolean {
  const [isDel, setIsDel] = useState(() => contentEvents.isDeleted(kind, id));
  useEffect(() => {
    setIsDel(contentEvents.isDeleted(kind, id));
    return contentEvents.subscribe((k, deletedId) => { if (k === kind && deletedId === id) setIsDel(true); });
  }, [kind, id]);
  return isDel;
}
