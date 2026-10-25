import { Stack } from 'expo-router';
import MyPlansScreen from '../src/screens/MyPlansScreen';

export default function MyPlansRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MyPlansScreen />
    </>
  );
}
