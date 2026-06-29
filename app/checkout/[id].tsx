import { Stack, useLocalSearchParams } from 'expo-router';
import CheckoutScreen from '../../src/screens/CheckoutScreen';

export default function CheckoutRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CheckoutScreen matchId={id ?? ''} />
    </>
  );
}
