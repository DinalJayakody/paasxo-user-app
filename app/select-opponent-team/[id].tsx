import { Stack, useLocalSearchParams } from 'expo-router';
import SelectOpponentTeamScreen from '../../src/screens/SelectOpponentTeamScreen';

export default function SelectOpponentTeamRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SelectOpponentTeamScreen bookingId={id ?? ''} />
    </>
  );
}
