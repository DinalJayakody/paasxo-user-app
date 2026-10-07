import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { matchScoreApi, RecordEventPayload } from '../api/matchScoreApi';
import { MatchScorecard } from '../types/api';
import { extractApiError } from '../utils/apiError';

const POLL_MS = 4000;

/**
 * The "complete, live scorecard" companion to useLiveMatchScore — rosters,
 * full event log, and server-computed per-sport aggregates. Kept as a
 * separate hook/poll loop (not folded into useLiveMatchScore) since it's a
 * distinct backend endpoint with its own concerns; a viewer who only cares
 * about the headline score/timer never needs to pay for this fetch.
 */
export function useMatchScorecard(bookingId: string | number | undefined, pollWhileActive: boolean) {
  const [scorecard, setScorecard] = useState<MatchScorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const inFlightRef = useRef(false);

  const fetchScorecard = useCallback(async () => {
    if (bookingId == null || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const data = await matchScoreApi.getScorecard(bookingId);
      setScorecard(data);
      setError(undefined);
    } catch (err) {
      setError(extractApiError(err, 'Could not load the scorecard'));
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    setLoading(true);
    fetchScorecard();
  }, [fetchScorecard]);

  useEffect(() => {
    if (bookingId == null || !pollWhileActive) return;
    let active = true;
    const interval = setInterval(() => {
      if (active && AppState.currentState === 'active') fetchScorecard();
    }, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [bookingId, pollWhileActive, fetchScorecard]);

  const recordEvent = useCallback(
    async (payload: RecordEventPayload) => {
      if (bookingId == null) return;
      setActionLoading(true);
      setError(undefined);
      try {
        await matchScoreApi.recordEvent(bookingId, payload);
        await fetchScorecard();
      } catch (err) {
        setError(extractApiError(err, 'Could not record that'));
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [bookingId, fetchScorecard]
  );

  const undoLastEvent = useCallback(async () => {
    if (bookingId == null) return;
    setActionLoading(true);
    setError(undefined);
    try {
      await matchScoreApi.undoLastEvent(bookingId);
      await fetchScorecard();
    } catch (err) {
      setError(extractApiError(err, 'Could not undo'));
      throw err;
    } finally {
      setActionLoading(false);
    }
  }, [bookingId, fetchScorecard]);

  return { scorecard, loading, actionLoading, error, refresh: fetchScorecard, recordEvent, undoLastEvent };
}
