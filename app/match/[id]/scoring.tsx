import { Stack, useLocalSearchParams } from 'expo-router';
import MatchScoreboardScreen from '../../../src/screens/MatchScoreboardScreen';

export default function NormalMatchScoringRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MatchScoreboardScreen matchId={id ?? ''} />
    </>
  );
}
