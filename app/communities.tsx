import { Stack } from 'expo-router';
import CommunitiesScreen from '../src/screens/CommunitiesScreen';

export default function CommunitiesRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CommunitiesScreen />
    </>
  );
}
