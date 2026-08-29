// ─── Google OAuth Client IDs ──────────────────────────────────────────────────
//
// WEB + IOS pulled from google-services.json (project paasxo-a3769):
//   - WEB is the client_type:3 entry under the top-level "oauth_client" array
//     (Firebase's auto-created "Web client").
//   - IOS is the client_type:2 entry under services.appinvite_service
//     .other_platform_oauth_client, matched by ios_info.bundle_id.
//
// ANDROID: genuine "Android" type OAuth client (Google Cloud Console confirms
// Type: Android), auto-created after registering com.paasxo.app + its debug
// keystore SHA-1 (5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25)
// in Firebase Console → Project Settings → Your apps → Android → Add
// fingerprint. This is what lets Google accept the native custom-scheme
// redirect (`com.paasxo.app:/oauthredirect`, hardcoded by expo-auth-session's
// Google provider) instead of blocking it with "doesn't comply with Google's
// OAuth 2.0 policy" - that redirect also needs a matching intent-filter for
// scheme "com.paasxo.app" in AndroidManifest.xml (already added).
export const GOOGLE_CLIENT_IDS = {
  WEB:     '135107198325-5tnmhagcsu2frmbl5fduk0qtvr9lb0et.apps.googleusercontent.com',
  IOS:     '135107198325-co0uscvalek3rq7jfulnai1j8gffm4sb.apps.googleusercontent.com',
  ANDROID: '135107198325-qgd3nhhm7d6ts61mniq547uufsu98v43.apps.googleusercontent.com',
} as const;

export const GOOGLE_CONFIGURED =
  !GOOGLE_CLIENT_IDS.WEB.startsWith('YOUR_');
