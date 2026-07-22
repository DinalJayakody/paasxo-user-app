// Live match-timer math, shared by the scoreboard (viewers) and the
// organizer's scoring screen so both tick in perfect sync.
//
// The server gives us elapsedSeconds "as of the moment it built the
// response" plus whether the timer is currently running. To animate a
// smooth per-second countup between polls without trusting client/server
// clock alignment (timerStartedAt is a *server* timestamp - comparing it
// directly against the client's Date.now() would drift by however far the
// two clocks are apart), we anchor purely to client-side time: remember
// what the server told us and what the client's clock read at that instant,
// then add however much client-side time has passed since.

export interface ElapsedTimeAnchor {
  serverElapsedSeconds: number;
  timerRunning: boolean;
  fetchedAtMs: number;
}

export function makeElapsedAnchor(state: { elapsedSeconds: number; timerRunning: boolean }): ElapsedTimeAnchor {
  return {
    serverElapsedSeconds: state.elapsedSeconds,
    timerRunning: state.timerRunning,
    fetchedAtMs: Date.now(),
  };
}

export function computeLiveElapsedSeconds(anchor: ElapsedTimeAnchor | null, nowMs: number = Date.now()): number {
  if (!anchor) return 0;
  if (!anchor.timerRunning) return anchor.serverElapsedSeconds;
  const delta = Math.max(0, Math.floor((nowMs - anchor.fetchedAtMs) / 1000));
  return anchor.serverElapsedSeconds + delta;
}

/** "5:07" under an hour, "1:05:07" once it runs past 60 minutes. */
export function formatMatchDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
