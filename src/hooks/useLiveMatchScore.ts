import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { matchScoreApi } from '../api/matchScoreApi';
import { MatchScoreState } from '../types/api';
import { extractApiError } from '../utils/apiError';
import { computeLiveElapsedSeconds, ElapsedTimeAnchor, makeElapsedAnchor } from '../utils/matchTimer';

const POLL_MS = 4000;

/**
 * Single source of truth for a match's live score/timer - used both by the
 * organizer's scoring screen (which also calls the mutating actions) and by
 * every viewer's read-only scoreboard (which only ever calls refresh/poll).
 * Polls the backend every few seconds while a scoring session exists
 * (NOT_STARTED included, so a viewer sees the moment the organizer starts
 * it) and stops once the match is COMPLETED. Between polls, the displayed
 * timer ticks forward once a second on the client for a smooth live feel.
 */
export function useLiveMatchScore(bookingId: string | number | undefined) {
  const [score, setScore] = useState<MatchScoreState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const anchorRef = useRef<ElapsedTimeAnchor | null>(null);

  const applyScore = useCallback((next: MatchScoreState) => {
    setScore(next);
    anchorRef.current = makeElapsedAnchor(next);
    setDisplaySeconds(next.elapsedSeconds);
  }, []);

  const fetchScore = useCallback(async () => {
    if (bookingId == null) return;
    try {
      const data = await matchScoreApi.getScore(bookingId);
      applyScore(data);
      setError(undefined);
    } catch (err) {
      setError(extractApiError(err, 'Could not load the live score'));
    } finally {
      setLoading(false);
    }
  }, [bookingId, applyScore]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchScore();
  }, [fetchScore]);

  // Poll while there's anything worth watching - stops once the match ends,
  // and pauses while the app is backgrounded to avoid wasted requests.
  useEffect(() => {
    if (bookingId == null || score?.status === 'COMPLETED') return;
    let active = true;
    const interval = setInterval(() => {
      if (active && AppState.currentState === 'active') fetchScore();
    }, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [bookingId, score?.status, fetchScore]);

  // Smooth 1s local tick between polls
  useEffect(() => {
    const tick = setInterval(() => {
      setDisplaySeconds(computeLiveElapsedSeconds(anchorRef.current));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const runAction = useCallback(
    async (fn: () => Promise<MatchScoreState>) => {
      setActionLoading(true);
      setError(undefined);
      try {
        const next = await fn();
        applyScore(next);
        return next;
      } catch (err) {
        setError(extractApiError(err, 'That action could not be completed'));
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [applyScore]
  );

  return {
    score,
    loading,
    actionLoading,
    error,
    displaySeconds,
    refresh: fetchScore,
    startMatch: () => runAction(() => matchScoreApi.startMatch(bookingId!)),
    pauseTimer: () => runAction(() => matchScoreApi.pauseTimer(bookingId!)),
    resumeTimer: () => runAction(() => matchScoreApi.resumeTimer(bookingId!)),
    endMatch: () => runAction(() => matchScoreApi.endMatch(bookingId!)),
    updateState: (payload: { teamAScore?: number; teamBScore?: number; state?: Record<string, any> }) =>
      runAction(() => matchScoreApi.updateState(bookingId!, payload)),
  };
}
