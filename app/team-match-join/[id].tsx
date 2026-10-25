import { Stack, useLocalSearchParams } from 'expo-router';
import TeamMatchJoinScreen from '../../src/screens/TeamMatchJoinScreen';

export default function TeamMatchJoinRoute() {
  const params = useLocalSearchParams<{ id: string; amountDue?: string; organizerTeamName?: string }>();
  const amountDue = params.amountDue ? Number(params.amountDue) : undefined;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TeamMatchJoinScreen
        bookingId={params.id ?? ''}
        initialAmountDue={amountDue != null && !Number.isNaN(amountDue) ? amountDue : undefined}
        initialOrganizerTeamName={params.organizerTeamName || undefined}
      />
    </>
  );
}
