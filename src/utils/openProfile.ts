import type { Router } from 'expo-router';

/**
 * The one way to open a user's profile from anywhere a user is shown (rosters,
 * participants, post/comment/reel/story authors, scorecards...). Your own uid
 * opens your Profile tab; anyone else opens their public profile. No-ops for a
 * missing uid, so callers can pass whatever they have.
 */
export function openProfile(router: Router, targetUid?: string | null, myUid?: string | null) {
  if (!targetUid) return;
  if (myUid && targetUid === myUid) {
    router.push('/profile' as any);
    return;
  }
  router.push(`/friend-profile?user=${encodeURIComponent(targetUid)}` as any);
}
