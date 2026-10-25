import { Stack, useLocalSearchParams } from 'expo-router';
import VenueDetailsScreen from '../../src/screens/VenueDetailsScreen';

export default function VenueDetailsRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <VenueDetailsScreen venueId={id ?? ''} />
    </>
  );
}
