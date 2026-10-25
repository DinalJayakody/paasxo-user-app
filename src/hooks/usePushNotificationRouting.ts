import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../api/notificationApi';
import { resolveNotificationRoute } from '../utils/notificationRoutes';
import {
  ACTIVITY_NOTIFICATION_ID, ACTIVITY_ACTION_PAUSE, ACTIVITY_ACTION_RESUME, ACTIVITY_ACTION_STOP,
} from '../lib/activityNotification';
import { dispatchActivityControl } from '../lib/activityControlBus';

const NOTIFICATION_ID = /^[A-Za-z0-9_-]{1,64}$/;

interface PendingOpen {
  route: string;
  notificationId: string | null;
}

/**
 * Opens the right screen when a push notification is tapped — the same screen
 * tapping it in the in-app Notifications list opens (resolveNotificationRoute),
 * falling back to the Notifications screen only when a type has no specific
 * destination.
 *
 * Handles every app state:
 *  - foreground / background: the response listener;
 *  - cold start (tap launched the app): getLastNotificationResponseAsync;
 *    both can report the same tap, so taps are de-duplicated.
 * Navigation waits until the user is signed in and the root redirect has run
 * (pathname is no longer "/"), so the destination isn't overwritten by the
 * launch redirect and Back returns to the app. The tapped notification is then
 * marked read, so the bell count stays accurate.
 */
export function usePushNotificationRouting() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const { user, loading } = useAuth();
  const handledTaps = useRef(new Set<string>());
  const pending = useRef<PendingOpen | null>(null);
  const [pendingVersion, setPendingVersion] = useState(0);

  const handleResponse = useCallback((response: Notifications.NotificationResponse) => {
    const request = response.notification.request;
    const tapKey = `${request.identifier}:${response.actionIdentifier}`;
    if (handledTaps.current.has(tapKey)) return;
    handledTaps.current.add(tapKey);

    // The live activity-tracking notification is local, not a push.
    if (request.identifier === ACTIVITY_NOTIFICATION_ID) {
      const action = response.actionIdentifier;
      // Never stack a second tracker on top of the open one — two live
      // trackers is what made a finished session look like it "resumed".
      const openTracker = () => {
        if (pathnameRef.current !== '/activity-tracker') router.push('/activity-tracker' as any);
      };
      if (action === ACTIVITY_ACTION_PAUSE || action === ACTIVITY_ACTION_RESUME || action === ACTIVITY_ACTION_STOP) {
        dispatchActivityControl(action);
        if (action === ACTIVITY_ACTION_STOP) openTracker();
        return;
      }
      openTracker();
      return;
    }

    const data = (request.content.data ?? {}) as Record<string, unknown>;
    const type = typeof data.type === 'string' ? data.type : '';
    if (!type) return; // not one of ours

    const route = resolveNotificationRoute({
      type,
      bookingId: data.bookingId as string | number | null | undefined,
      invitationId: typeof data.invitationId === 'string' ? data.invitationId : null,
      snap: data, // the push carries the routing ids flattened at the top level
    }) ?? '/notifications';
    const notificationId = typeof data.notificationId === 'string' && NOTIFICATION_ID.test(data.notificationId)
      ? data.notificationId : null;

    pending.current = { route, notificationId };
    setPendingVersion((v) => v + 1);
  }, [router]);

  // Taps while the app is running, plus the tap that cold-launched it.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    Notifications.getLastNotificationResponseAsync()
      .then((last) => { if (last) handleResponse(last); })
      .catch(() => {});
    return () => sub.remove();
  }, [handleResponse]);

  // Navigate once the app can actually show the destination.
  const ready = !loading && !!user && pathname !== '/';
  useEffect(() => {
    if (!ready || !pending.current) return;
    const { route, notificationId } = pending.current;
    pending.current = null;
    router.push(route as any);
    if (notificationId) notificationApi.markRead(notificationId).catch(() => {});
    // Consumed — don't replay this tap on a later re-mount.
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [ready, pendingVersion, router]);
}
