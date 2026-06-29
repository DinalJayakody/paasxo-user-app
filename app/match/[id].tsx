import { Stack, useLocalSearchParams } from 'expo-router';
import MatchDetailsScreen from '../../src/screens/MatchDetailsScreen';

export default function MatchRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MatchDetailsScreen matchId={id ?? ''} />
    </>
  );
}
