import { Stack, useLocalSearchParams } from 'expo-router';
import TeamDetailScreen from '../../src/screens/TeamDetailScreen';

export default function TeamRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TeamDetailScreen teamId={id ?? ''} />
    </>
  );
}
