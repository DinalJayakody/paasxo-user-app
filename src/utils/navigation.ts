import type { Router } from 'expo-router';

/**
 * Safe replacement for router.back() - falls back to `fallback` (default
 * '/home') when there's no screen to go back to. That happens whenever a
 * screen is entered directly rather than pushed from within the app - a
 * deep link, a push notification, or a shared link - and router.back()
 * alone just silently does nothing in that case (a dev-only console warning
 * in development; in production the back button simply appears dead).
 */
export function goBack(router: Router, fallback: string = '/home') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
