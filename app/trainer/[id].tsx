import { Stack, useLocalSearchParams } from 'expo-router';
import TrainerProfileScreen from '../../src/screens/TrainerProfileScreen';

export default function TrainerProfileRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TrainerProfileScreen trainerId={id ?? ''} />
    </>
  );
}
