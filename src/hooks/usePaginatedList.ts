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

  const reload = useCallback(() => {
    setLoading(true);
    fetchPage(0)
      .then((res) => {
        setData(res.content);
        setHasMore(res.hasMore);
        setPage(0);
      })
      .catch(() => {
        setData([]);
        setHasMore(false);
      })
      .finally(() => setLoading(false));
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    fetchPage(nextPage)
      .then((res) => {
        setData((prev) => {
          const map = new Map(prev.map((item) => [keyExtractor(item), item]));
          res.content.forEach((item) => map.set(keyExtractor(item), item));
          return Array.from(map.values());
        });
        setHasMore(res.hasMore);
        setPage(nextPage);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [fetchPage, hasMore, loadingMore, page, keyExtractor]);

  const reset = useCallback(() => {
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
