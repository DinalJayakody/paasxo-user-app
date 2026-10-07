import { useCallback, useRef, useState } from 'react';

/**
 * Generic 10-at-a-time paginated list, extracted from FriendsScreen so the
 * same fetch/append/dedupe logic can back other paginated lists (e.g.
 * FollowListModal) without duplicating it.
 */
export interface PaginatedList<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
  reset: () => void;
  updateItem: (id: string, patch: Partial<T>) => void;
  removeItem: (id: string) => void;
  momentumRef: React.MutableRefObject<boolean>;
}

export function usePaginatedList<T>(
  fetchPage: (page: number) => Promise<{ content: T[]; hasMore: boolean }>,
  keyExtractor: (item: T) => string
): PaginatedList<T> {
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const momentumRef = useRef(false);

  // Guards against a slow, now-stale reload() clobbering a faster, newer one
  // — real risk once a caller's fetchPage changes on every keystroke (a
  // search box debounced into this hook, e.g. LikesModal): type "al", pause
  // long enough to fire a request, keep typing "alex" before "al"'s request
  // has actually returned, and whichever of the two responses lands second
  // used to win regardless of which query it was actually answering. Each
  // reload() claims the next id; a response is only applied if its id is
  // still the most recent one issued by the time it resolves.
  const requestIdRef = useRef(0);

  const reload = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    fetchPage(0)
      .then((res) => {
        if (requestId !== requestIdRef.current) return;
        setData(res.content);
        setHasMore(res.hasMore);
        setPage(0);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setData([]);
        setHasMore(false);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    const nextPage = page + 1;
    fetchPage(nextPage)
      .then((res) => {
        if (requestId !== requestIdRef.current) return;
        setData((prev) => {
          const map = new Map(prev.map((item) => [keyExtractor(item), item]));
          res.content.forEach((item) => map.set(keyExtractor(item), item));
          return Array.from(map.values());
        });
        setHasMore(res.hasMore);
        setPage(nextPage);
      })
      .catch(() => {
        if (requestId === requestIdRef.current) setHasMore(false);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoadingMore(false);
      });
  }, [fetchPage, hasMore, loadingMore, page, keyExtractor]);

  const reset = useCallback(() => {
    // Invalidates any reload()/loadMore() still in flight so it can't land
    // afterward and silently repopulate what this just cleared.
    requestIdRef.current += 1;
    setData([]);
    setHasMore(true);
    setPage(0);
    setLoading(false);
    setLoadingMore(false);
  }, []);

  const updateItem = useCallback(
    (id: string, patch: Partial<T>) => {
      setData((prev) => prev.map((item) => (keyExtractor(item) === id ? { ...item, ...patch } : item)));
    },
    [keyExtractor]
  );

  const removeItem = useCallback(
    (id: string) => {
      setData((prev) => prev.filter((item) => keyExtractor(item) !== id));
    },
    [keyExtractor]
  );

  return { data, loading, loadingMore, hasMore, reload, loadMore, reset, updateItem, removeItem, momentumRef };
}
