import { Stack, useLocalSearchParams } from 'expo-router';
import MatchFullScorecardScreen from '../../../src/screens/MatchFullScorecardScreen';

export default function MatchFullScorecardRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MatchFullScorecardScreen matchId={id ?? ''} />
    </>
  );
}
