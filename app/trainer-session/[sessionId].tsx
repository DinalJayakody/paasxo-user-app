import { Stack, useLocalSearchParams } from 'expo-router';
import TrainerSessionDetailsScreen from '../../src/screens/TrainerSessionDetailsScreen';

export default function TrainerSessionDetailsRoute() {
  const params = useLocalSearchParams();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TrainerSessionDetailsScreen sessionId={sessionId ?? ''} />
    </>
  );
}
