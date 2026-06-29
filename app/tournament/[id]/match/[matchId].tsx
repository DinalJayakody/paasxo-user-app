import { Stack, useLocalSearchParams } from 'expo-router';
import MatchScoringScreen from '../../../../src/screens/MatchScoringScreen';

export default function TournamentMatchRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MatchScoringScreen tournamentId={id ?? ''} matchId={matchId ?? ''} />
    </>
  );
}
