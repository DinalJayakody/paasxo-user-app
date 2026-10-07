import { Stack } from 'expo-router';
import CreateCommunityScreen from '../src/screens/CreateCommunityScreen';

export default function CreateCommunityRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CreateCommunityScreen />
    </>
  );
}
