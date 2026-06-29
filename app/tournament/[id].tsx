import { Stack, useLocalSearchParams } from 'expo-router';
import TournamentDetailsScreen from '../../src/screens/TournamentDetailsScreen';

export default function TournamentRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TournamentDetailsScreen tournamentId={id ?? ''} />
    </>
  );
}
