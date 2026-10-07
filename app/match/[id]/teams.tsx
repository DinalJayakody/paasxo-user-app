import { Stack, useLocalSearchParams } from 'expo-router';
import MatchTeamsScreen from '../../../src/screens/MatchTeamsScreen';

export default function MatchTeamsRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MatchTeamsScreen matchId={id ?? ''} />
    </>
  );
}
