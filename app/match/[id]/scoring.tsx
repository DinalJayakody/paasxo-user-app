import { Stack, useLocalSearchParams } from 'expo-router';
import MatchScoringScreen from '../../../src/screens/MatchScoringScreen';

export default function NormalMatchScoringRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MatchScoringScreen normalMatchId={id ?? ''} />
    </>
  );
}
