import { Stack } from 'expo-router';
import TournamentsListScreen from '../src/screens/TournamentsListScreen';

export default function TournamentsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TournamentsListScreen />
    </>
  );
}
