import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pull-to-refresh state for a screen. `refreshFn` must re-run exactly the
 * loaders the screen runs when it first opens (fresh server data, no cache),
 * so a pull always lands on the same up-to-date state as a first visit.
 *
 * - A second pull while one is still in flight is ignored (no duplicate
 *   requests).
 * - The spinner always stops, even if a loader throws — screens keep showing
 *   their last good data and surface errors their own way.
 * - Safe if the screen unmounts mid-refresh.
 */
export function usePullToRefresh(refreshFn: () => unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const fnRef = useRef(refreshFn);
  fnRef.current = refreshFn;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const onRefresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      await Promise.resolve(fnRef.current());
    } catch {
      // Each loader handles/reports its own errors; refresh just must not hang.
    } finally {
      inFlight.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}
