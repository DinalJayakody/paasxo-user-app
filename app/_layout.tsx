import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/src/context/AuthContext';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: 'transparent' },
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
          <Stack.Screen name="+not-found" />
        </Stack>

        <StatusBar style="dark" />
      </SafeAreaProvider>
    </AuthProvider>
  );
}