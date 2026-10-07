import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Colors } from '@/src/styles/colors';
import WelcomeScreen from '@/src/screens/WelcomeScreen';
import { loadTrackingSession } from '@/src/lib/activeTrackingSession';

/**
 * Root route — the one place that decides "onboarding carousel" vs "straight
 * into the app," so a signed-in user who force-closes the app (or restarts
 * their phone) lands back in /home instead of the welcome screen every time.
 * AuthContext's own session restore (AsyncStorage-backed tokens, refreshed
 * transparently) was already correct - this screen just never consulted it.
 *
 * Also the one place that can catch a Walk/Run/Cycling session that was
 * still ACTIVE/PAUSED when the OS fully killed the app — on iOS especially,
 * force-quitting the app is the user's explicit signal to Apple to stop
 * everything, including background location delivery, so tracking itself
 * cannot continue through a real kill (that's a platform limit, not
 * something fixable from JS without a native Live Activity/widget
 * extension). What IS fixable is where the user lands on relaunch:
 * ActivityTrackerScreen already has a full Resume-or-Discard flow
 * (useActivityTracking's checkpointing, resumeFromSession) built entirely
 * around exactly this scenario, but it only ever ran if the user happened
 * to navigate back to /activity-tracker themselves — a cold relaunch
 * defaults here and went to /home instead, silently stranding the
 * in-progress session's recovered data behind a screen nobody was shown.
 * This one extra check (a single local AsyncStorage read — no network/
 * backend call, so no added server cost) routes straight to the tracker
 * instead whenever a session is still sitting there unresolved.
 */
export default function Index() {
  const { user, loading } = useAuth();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasResumableSession, setHasResumableSession] = useState(false);

  useEffect(() => {
    if (!user) {
      setSessionChecked(true);
      return;
    }
    let cancelled = false;
    loadTrackingSession().then((session) => {
      if (cancelled) return;
      setHasResumableSession(session != null);
      setSessionChecked(true);
    });
    return () => { cancelled = true; };
  }, [user]);

  if (loading || (user && !sessionChecked)) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={Colors.white} size="large" />
      </View>
    );
  }

  if (user) {
    return <Redirect href={hasResumableSession ? '/activity-tracker' : '/home'} />;
  }

  return <WelcomeScreen />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
});
