import { Stack, useLocalSearchParams } from 'expo-router';
import TrainerCheckoutScreen from '../../src/screens/TrainerCheckoutScreen';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function TrainerCheckoutRoute() {
  const params = useLocalSearchParams();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TrainerCheckoutScreen
        slotId={param(params.slotId)}
        sessionId={param(params.sessionId)}
        sessionTitle={param(params.sessionTitle)}
        trainerDisplayName={param(params.trainerDisplayName)}
        category={param(params.category)}
        imageUrl={param(params.imageUrl)}
        slotDate={param(params.slotDate)}
        startTime={param(params.startTime)}
        endTime={param(params.endTime)}
        location={param(params.location)}
        isOnline={param(params.isOnline) === '1'}
        price={param(params.price)}
      />
    </>
  );
}
