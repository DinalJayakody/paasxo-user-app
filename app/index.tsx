import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Colors } from '@/src/styles/colors';
import WelcomeScreen from '@/src/screens/WelcomeScreen';

/**
 * Root route — the one place that decides "onboarding carousel" vs "straight
 * into the app," so a signed-in user who force-closes the app (or restarts
 * their phone) lands back in /home instead of the welcome screen every time.
 * AuthContext's own session restore (AsyncStorage-backed tokens, refreshed
 * transparently) was already correct - this screen just never consulted it.
 */
export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={Colors.white} size="large" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/home" />;
  }

  return <WelcomeScreen />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary },
});
