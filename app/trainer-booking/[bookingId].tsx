import { Stack, useLocalSearchParams } from 'expo-router';
import TrainerBookingDetailScreen from '../../src/screens/TrainerBookingDetailScreen';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function TrainerBookingDetailRoute() {
  const params = useLocalSearchParams();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TrainerBookingDetailScreen
        bookingId={param(params.bookingId)}
        sessionTitle={param(params.sessionTitle)}
        trainerDisplayName={param(params.trainerDisplayName)}
        slotDate={param(params.slotDate)}
        startTime={param(params.startTime)}
        endTime={param(params.endTime)}
        pricePaid={param(params.pricePaid)}
        status={param(params.status)}
      />
    </>
  );
}
