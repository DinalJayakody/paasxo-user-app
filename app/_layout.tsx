import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/src/context/AuthContext';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { configurePushNotificationHandler } from '@/src/lib/push';
import { ACTIVITY_NOTIFICATION_ID, ACTIVITY_ACTION_PAUSE, ACTIVITY_ACTION_RESUME, ACTIVITY_ACTION_STOP } from '@/src/lib/activityNotification';
import { dispatchActivityControl } from '@/src/lib/activityControlBus';
// Registers the background GPS task (TaskManager.defineTask) at module
// scope — this import's only purpose is that side effect. Must happen this
// early so Expo can re-attach the task after the JS engine is torn down and
// recreated while the app is backgrounded during an active tracking session.
import '@/src/lib/activityLocationTask';

// Without this, a push received while the app is in the foreground is
// silently swallowed instead of showing a banner/sound. Must run before any
// screen mounts, so it's called at module scope, not inside a component.
configurePushNotificationHandler();

function RootLayoutNav() {
  const { colors, resolvedTheme } = useTheme();
  const router = useRouter();

  // Tapping a push (app backgrounded/killed) opens the in-app notification
  // feed, which already knows how to deep-link every notification type from
  // its full matchSnapshot — the push payload itself only carries
  // type/bookingId/invitationId, not enough to replicate every one of those
  // routes directly. The one exception is the live activity-tracking
  // notification (see activityNotification.ts) — that one isn't a push at
  // all and has nothing to do with the notification feed, so it routes
  // straight back to the tracker instead.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.identifier === ACTIVITY_NOTIFICATION_ID) {
        const action = response.actionIdentifier;
        // Pause/Resume/Stop button taps (see activityNotification.ts's
        // categories) control the live session via activityControlBus
        // instead of navigating — Pause/Resume apply silently in place,
        // Stop still opens the tracker so its confirm dialog is visible.
        if (action === ACTIVITY_ACTION_PAUSE || action === ACTIVITY_ACTION_RESUME || action === ACTIVITY_ACTION_STOP) {
          dispatchActivityControl(action);
          if (action === ACTIVITY_ACTION_STOP) router.push('/activity-tracker' as any);
          return;
        }
        router.push('/activity-tracker' as any);
      } else {
        router.push('/notifications' as any);
      }
    });
    return () => sub.remove();
  }, [router]);

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          // An opaque background here matters: with a transparent content
          // style, the outgoing screen can show through underneath the
          // incoming one for the duration of the slide transition, which
          // reads as a jarring "screens combining" glitch. Every screen in
          // this app paints its own opaque background anyway, so this only
          // ever shows for the transition's duration.
          contentStyle: { backgroundColor: colors.background },
        }}
      >
          <Stack.Screen name="index" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="post-verification" />
          <Stack.Screen name="home" />
          <Stack.Screen name="feed" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="friend-profile" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="create-post" />
          <Stack.Screen name="create-match" />
          <Stack.Screen name="create-public-match" />
          <Stack.Screen name="create-tournament" />
          <Stack.Screen name="tournaments" />
          <Stack.Screen name="match/[id]" />
          <Stack.Screen name="join-match/[id]" />
          <Stack.Screen name="join-checkout/[id]" />
          <Stack.Screen name="checkout/[id]" />
          <Stack.Screen name="booking-status/[id]" />
          <Stack.Screen name="tournament/[id]" />
          <Stack.Screen name="tournament/[id]/match/[matchId]" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="chat/[userId]" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="subscription" />
          <Stack.Screen name="one-time-payment" />
          <Stack.Screen name="walk-run" />
          <Stack.Screen name="activity-tracker" />
          <Stack.Screen name="activity-history" />
          <Stack.Screen name="activity/[id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="communities" />
          <Stack.Screen name="create-community" />
          <Stack.Screen name="community/[id]" />
          <Stack.Screen name="reel/[id]" />
          <Stack.Screen name="create-team-challenge-match" />
          <Stack.Screen name="select-opponent-team/[id]" />
          <Stack.Screen name="+not-found" />
        </Stack>

        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}