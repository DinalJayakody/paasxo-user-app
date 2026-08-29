import { Stack, useLocalSearchParams } from 'expo-router';
import TrainerBookingConfirmedScreen from '../../src/screens/TrainerBookingConfirmedScreen';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function TrainerBookingConfirmedRoute() {
  const params = useLocalSearchParams();

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <TrainerBookingConfirmedScreen
        bookingId={param(params.bookingId)}
        sessionTitle={param(params.sessionTitle)}
        trainerDisplayName={param(params.trainerDisplayName)}
        slotDate={param(params.slotDate)}
        startTime={param(params.startTime)}
        endTime={param(params.endTime)}
        location={param(params.location)}
        isOnline={param(params.isOnline) === '1'}
        pricePaid={param(params.pricePaid)}
      />
    </>
  );
}
