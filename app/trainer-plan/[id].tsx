import { Stack, useLocalSearchParams } from 'expo-router';
import TrainerPlanScreen from '../../src/screens/TrainerPlanScreen';

export default function TrainerPlanRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TrainerPlanScreen planId={id ?? ''} />
    </>
  );
}
