import { Stack, useLocalSearchParams } from 'expo-router';
import BookingStatusScreen from '../../src/screens/BookingStatusScreen';

export default function BookingStatusRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  // pending=true is passed by CheckoutScreen after creating a new match (always starts pending)
  const forcePending = params.pending === 'true';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BookingStatusScreen matchId={id ?? ''} forcePending={forcePending} />
    </>
  );
}
