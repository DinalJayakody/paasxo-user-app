import { Stack } from 'expo-router';
import CommunityDetailScreen from '../../src/screens/CommunityDetailScreen';

export default function CommunityRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CommunityDetailScreen />
    </>
  );
}
