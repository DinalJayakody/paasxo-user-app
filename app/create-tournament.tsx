import { Stack } from 'expo-router';
import CreateTournamentScreen from '../src/screens/CreateTournamentScreen';

export default function CreateTournamentRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CreateTournamentScreen />
    </>
  );
}
