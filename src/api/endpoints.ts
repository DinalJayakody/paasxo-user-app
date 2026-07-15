import { Platform } from 'react-native';

// ─── Backend URL Config ──────────────────────────────────────────────────────
// Each environment gets the right URL automatically — no manual switching needed.
//
// iOS Simulator  → localhost (direct, no tunnel needed)
// Android Emulator → 10.0.2.2 (Android's alias for the host machine)
// Physical device → your Mac's LAN IP (run: ipconfig getifaddr en0)
// Web (Vercel)   → Cloudflare tunnel URL (run: bash start-tunnel.sh)
//
// ↓ Update this URL each time you run: bash start-tunnel.sh
const TUNNEL_URL = 'https://centres-station-chicago-dot.trycloudflare.com/api';

// Production (update after deploying to Hostinger):
// const PRODUCTION_URL = 'https://api.paasxo.com/api';

function resolveBaseUrl(): string {
  if (Platform.OS === 'web') return TUNNEL_URL;
  if (Platform.OS === 'ios') return 'http://localhost:8080/api';        // iOS Simulator → user backend
  // Physical device on same WiFi: 'http://192.168.1.10:8080/api'
  return 'http://10.0.2.2:8080/api';                                    // Android Emulator → user backend
}

// ─────────────────────────────────────────────────────────────────────────────

export const ENDPOINTS = {
  BASE_URL: resolveBaseUrl(),
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh-token',
    GOOGLE_LOGIN: '/auth/login-google',
    APPLE_LOGIN: '/auth/social/apple',
    FORGOT_PASSWORD: '/auth/forgot-password',
    // Popup shown right after a first-time Google sign-in to collect the
    // activity + referral code the normal registration form would have.
    COMPLETE_PROFILE: '/auth/complete-profile',
  },
  // com.pasxo.controller.AuthController exposes profile under /auth, not /user.
  // NOTE: the real PUT /auth/profile is multipart (UpdateProfileRequest +
  // optional profileImage part), not the plain JSON body userApi.updateProfile
  // currently sends - profile editing still needs backend-shape alignment.
  USER: {
    PROFILE: '/auth/profile',
    UPDATE_PROFILE: '/auth/profile',
    UPLOAD_AVATAR: '/auth/profile',
  },

  // Matches com.pasxo.controller.BookingController exactly. There is no
  // per-id GET, no PUT/update, and no join/checkout endpoint on the backend
  // yet - match details are found by filtering the /bookings/my list.
  BOOKINGS: {
    MY: '/bookings/my',
    JOINED: '/bookings/joined',
    FILTER: '/bookings/filter',
    CREATE: '/bookings',
    CANCEL: (id: string | number) => `/bookings/${id}/cancel`,
    ADD_PLAYERS: (id: string | number) => `/bookings/${id}/players`,
    JOIN: (id: string | number) => `/bookings/${id}/join`,
  },

  // Matches com.pasxo.controller.FutsalController exactly. There is no
  // search-by-query endpoint on the backend - venue search is done by
  // filtering the full /futsals list on the client.
  FUTSAL: {
    LIST: '/futsals',
    FILTER: '/futsals/filter',
    DETAIL: (id: string | number) => `/futsals/${id}`,
    SLOTS: (id: string | number, date: string) =>
      `/futsals/${id}/slots?date=${encodeURIComponent(date)}`,
    AVAILABLE_SLOTS: (id: string | number, date: string) =>
      `/futsals/${id}/slots/available?date=${encodeURIComponent(date)}`,
  },

  // Matches com.pasxo.controller.TournamentController exactly. There is NO
  // score-update or status-transition endpoint yet (TournamentMatch has
  // teamAScore/teamBScore/status columns, but nothing writes to them) - the
  // SCORE endpoint below is speculative and the frontend falls back to a
  // local cache (src/utils/tournamentStorage.ts) if it 404s.
  TOURNAMENTS: {
    CREATE: (futsalId: string | number) => `/futsals/${futsalId}/tournaments`,
    LIST_FOR_FUTSAL: (futsalId: string | number) => `/futsals/${futsalId}/tournaments`,
    DETAIL: (tournamentId: string | number) => `/tournaments/${tournamentId}`,
    CREATE_TEAM: (tournamentId: string | number) => `/tournaments/${tournamentId}/teams`,
    LIST_TEAMS: (tournamentId: string | number) => `/tournaments/${tournamentId}/teams`,
    ADD_PLAYER: (tournamentId: string | number, teamId: string | number) =>
      `/tournaments/${tournamentId}/teams/${teamId}/players`,
    LIST_PLAYERS: (tournamentId: string | number, teamId: string | number) =>
      `/tournaments/${tournamentId}/teams/${teamId}/players`,
    CREATE_MATCH: (tournamentId: string | number) => `/tournaments/${tournamentId}/matches`,
    LIST_MATCHES: (tournamentId: string | number) => `/tournaments/${tournamentId}/matches`,
    // Speculative - not implemented on the backend yet.
    UPDATE_SCORE: (tournamentId: string | number, matchId: string | number) =>
      `/tournaments/${tournamentId}/matches/${matchId}/score`,
  },

  STORIES: {
    CREATE: '/stories',
    FEED: '/stories/feed',
    MY: '/stories/my',
    VIEW: (id: string) => `/stories/${id}/view`,
    DELETE: (id: string) => `/stories/${id}`,
  },

  INVITATIONS: {
    INVITE: '/match-invitations/invite',
    REQUEST: '/match-invitations/request',
    DIRECT_ADD: '/match-invitations/direct-add',
    ACCEPT: (id: string) => `/match-invitations/${id}/accept`,
    DECLINE: (id: string) => `/match-invitations/${id}/decline`,
    COMPLETE_PAYMENT: (id: string) => `/match-invitations/${id}/complete-payment`,
    RECEIVED: '/match-invitations/received',
  },

  NOTIFICATIONS: {
    ALL: '/notifications',
    UNREAD_COUNT: '/notifications/unread-count',
    MARK_READ: (id: string) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/read-all',
  },

  TOURNAMENTS_GLOBAL: {
    LIST: '/tournaments',
    FILTER: '/tournaments/filter',
  },

  ACTIVITIES: {
    CREATE: '/activities',
    MY: '/activities/my',
    DETAIL: (id: string) => `/activities/${id}`,
    DELETE: (id: string) => `/activities/${id}`,
  },

  // Vendor-only actions (accept/reject a booking request, vendor notifications feed) live
  // in the Vendor App (vendor-app/src/api/*), not here — this app is the customer-facing
  // surface only. See vendor-app's ENDPOINTS.bookings.acceptAsVendor/rejectAsVendor.

  SOCIAL: {
    CREATE_POST: '/social/posts',
    USERS_BY_FIREBASE_UIDS: '/social/users/by-firebase-uids',
    SEARCH_USERS: (query: string) =>
      `/social/users/search/${encodeURIComponent(query)}`,
    FEED: '/social/feed',
    GET_USER_PROFILE: (id: string) =>
      `/social/users/${id}/profile`,
    GET_USER_POSTS: (userId: string) =>
      `/social/users/${userId}/posts`,
    GET_POST: (id: string | number) =>
      `/social/posts/${id}`,
    LIKE_POST: (id: string | number) =>
      `/social/posts/${id}/like`,
    UNLIKE_POST: (id: string | number) =>
      `/social/posts/${id}/unlike`,
    GET_COMMENTS: (id: string | number) =>
      `/social/posts/${id}/comments`,
    ADD_COMMENT: (id: string | number) =>
      `/social/posts/${id}/comments`,

    FOLLOW: (id: string) => `/social/users/${id}/follow`,
    UNFOLLOW: (id: string) => `/social/users/${id}/unfollow`,
    GET_FOLLOWERS: (id: string) => `/social/users/${id}/followers`,
    GET_FOLLOWING: (id: string) => `/social/users/${id}/following`,
  },
};

export default ENDPOINTS;

/*
  Notes:
  - Keep this file small and environment-agnostic. Use a build-time replace (dotenv, eas.json, CI) to set BASE_URL per environment.
  - For Swagger/OpenAPI generated clients, add a separate directory and map generated paths here as needed.
*/
