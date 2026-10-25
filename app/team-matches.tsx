import { Stack } from 'expo-router';
import TeamMatchesScreen from '../src/screens/TeamMatchesScreen';

export default function TeamMatchesRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TeamMatchesScreen />
    </>
  );
}
