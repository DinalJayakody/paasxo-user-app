import { Stack } from 'expo-router';
import CreateTeamScreen from '../src/screens/CreateTeamScreen';

export default function CreateTeamRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CreateTeamScreen />
    </>
  );
}
