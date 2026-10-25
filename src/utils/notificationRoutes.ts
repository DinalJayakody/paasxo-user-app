/**
 * The single source of truth for "where does tapping this notification go" —
 * used by the in-app Notifications list AND by tapped push notifications
 * (app/_layout.tsx), so both always land on the same screen.
 *
 * Every id is validated against a strict pattern before it's placed in a
 * route, so a malformed or tampered payload can never produce an unexpected
 * path or inject query parameters. Returns null when there's no specific
 * destination (callers fall back to the Notifications screen).
 */

export interface NotificationRouteSource {
  type: string;
  bookingId?: string | number | null;
  invitationId?: string | null;
  invitationStatus?: string | null;
  /** The notification's matchSnapshot (in-app) or the push's flattened route keys. */
  snap?: Record<string, unknown> | null;
}

const NUMERIC_ID = /^\d{1,18}$/;
// Mongo ObjectIds, Firebase uids, UUIDs — letters, digits, '-' and '_' only.
const OPAQUE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function asId(value: unknown, pattern: RegExp): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return pattern.test(s) ? s : null;
}
const num = (v: unknown) => asId(v, NUMERIC_ID);
const opaque = (v: unknown) => asId(v, OPAQUE_ID);

/** Booking lifecycle + invitation outcomes: the match screen shows the current state of all of these. */
const MATCH_TYPES = new Set([
  'INVITATION_ACCEPTED', 'INVITATION_DECLINED', 'INVITATION_EXPIRED',
  'PAYMENT_SUCCESSFUL', 'PLAYER_JOINED', 'PLAYER_ADDED_DIRECTLY', 'PLAYER_LEFT_MATCH',
  'MATCH_CANCELLED_NOTIFY', 'MATCH_REMINDER', 'VENUE_CLOSED',
  'BOOKING_CONFIRMED', 'BOOKING_REJECTED', 'BOOKING_PENDING_VENDOR_APPROVAL',
  'TEAM_MATCH_CHALLENGE_RECEIVED', 'TEAM_MATCH_CHALLENGE_ACCEPTED', 'TEAM_MATCH_CHALLENGE_DECLINED',
]);

export function resolveNotificationRoute(n: NotificationRouteSource): string | null {
  const snap = n.snap ?? {};
  const bookingId = num(n.bookingId) ?? num(snap.bookingId);
  const invitationId = opaque(n.invitationId) ?? opaque(snap.invitationId);
  const enc = encodeURIComponent;

  switch (n.type) {
    // ── Match invitations & join requests ────────────────────────────────
    case 'INVITATION_RECEIVED':
      // Sent both to an invited player and to an organizer receiving a join
      // request. The match screen handles both: the organizer sees pending
      // requests (Accept/Decline); an invited player sees an invitation card.
      if (!bookingId) return null;
      return invitationId ? `/match/${bookingId}?invitationId=${enc(invitationId)}` : `/match/${bookingId}`;
    case 'PAYMENT_REQUIRED':
      // Straight to paying for the spot.
      if (bookingId && invitationId) return `/join-checkout/${bookingId}?invitationId=${enc(invitationId)}`;
      return bookingId ? `/match/${bookingId}` : null;

    // ── Social ───────────────────────────────────────────────────────────
    case 'FOLLOW_REQUEST_RECEIVED':
    case 'FOLLOW_REQUEST_ACCEPTED':
    case 'NEW_FOLLOWER': {
      const uid = opaque(snap.firebaseUid);
      return uid ? `/friend-profile?user=${enc(uid)}` : null;
    }
    case 'POST_LIKED':
    case 'POST_COMMENTED': {
      // Always about the recipient's own post: open it in their profile; a
      // comment notification also opens the comment sheet straight away.
      const postId = opaque(snap.postId);
      if (!postId) return null;
      return `/profile?openPostId=${enc(postId)}${n.type === 'POST_COMMENTED' ? '&openComments=1' : ''}`;
    }
    case 'POST_TAGGED': {
      // Someone else's post you're tagged in — its own screen (privacy-checked server-side).
      const postId = opaque(snap.postId);
      return postId ? `/post/${enc(postId)}` : null;
    }
    case 'STORY_TAGGED': {
      const storyId = opaque(snap.storyId);
      return storyId ? `/story/${enc(storyId)}` : null;
    }
    case 'CHAT_MESSAGE': {
      const groupMatch = snap.matchBookingId != null ? String(snap.matchBookingId) : null;
      if (groupMatch && /^\d{1,12}$/.test(groupMatch)) return `/chat/match/${groupMatch}`;
      const uid = opaque(snap.senderUid);
      return uid ? `/chat/${enc(uid)}` : null;
    }
    case 'REEL_LIKED': {
      const reelId = opaque(snap.reelId);
      return reelId ? `/profile?openReelId=${enc(reelId)}&tab=Reels` : null;
    }
    case 'WALK_RUN_INVITE_RECEIVED':
    case 'WALK_RUN_INVITE_ACCEPTED':
    case 'WALK_RUN_INVITE_DECLINED': {
      // No walk/run viewer exists yet — open the other person's profile.
      const uid = opaque(snap.firebaseUid);
      return uid ? `/friend-profile?user=${enc(uid)}` : null;
    }

    // ── Tournaments, trainers, discovery ─────────────────────────────────
    case 'TOURNAMENT_TEAM_INVITED':
    case 'TOURNAMENT_TEAM_JOINED':
    case 'TOURNAMENT_PLAYER_ADDED':
    case 'TOURNAMENT_REMINDER': {
      const id = num(snap.tournamentId);
      return id ? `/tournament/${id}` : null;
    }
    case 'TRAINER_NEW_SESSION':
    case 'SESSION_REMINDER':
    case 'TRAINER_SESSION_CANCELLED':
    case 'TRAINER_SESSION_JOINED': {
      const id = num(snap.sessionId);
      return id ? `/trainer-session/${id}` : null;
    }
    case 'TRAINER_PLAN_PERSONAL': {
      // The plan the trainer wrote for / gave this user.
      const id = num(snap.planId);
      return id ? `/trainer-plan/${id}` : '/my-plans';
    }
    case 'NEARBY_SUGGESTION': {
      // The new venue's own page; the venue list if the id is missing.
      const venueId = num(snap.venueId);
      return venueId ? `/venue/${venueId}` : '/explore?category=VENUES';
    }

    // ── Teams ────────────────────────────────────────────────────────────
    case 'TEAM_MEMBER_LEFT':
    case 'TEAM_CAPTAIN_ASSIGNED': {
      const teamId = opaque(snap.teamId);
      return teamId ? `/team/${enc(teamId)}` : null;
    }
    case 'TEAM_CHALLENGE_RECEIVED': {
      const teamId = opaque(snap.challengedTeamId);
      return teamId ? `/team/${enc(teamId)}` : null;
    }
    case 'TEAM_CHALLENGE_ACCEPTED':
    case 'TEAM_CHALLENGE_DECLINED': {
      const teamId = opaque(snap.challengerTeamId);
      return teamId ? `/team/${enc(teamId)}` : null;
    }

    // ── Communities ──────────────────────────────────────────────────────
    case 'COMMUNITY_JOIN_REQUEST': {
      const id = opaque(snap.communityId);
      return id ? `/community/${enc(id)}?openRequests=1` : null;
    }
    case 'COMMUNITY_JOIN_APPROVED':
    case 'COMMUNITY_JOIN_DECLINED': {
      const id = opaque(snap.communityId);
      return id ? `/community/${enc(id)}` : null;
    }

    default:
      if (MATCH_TYPES.has(n.type) || n.invitationStatus === 'JOIN_COMPLETED') {
        return bookingId ? `/match/${bookingId}` : null;
      }
      return null;
  }
}
