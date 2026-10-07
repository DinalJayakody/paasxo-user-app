import { Stack, useLocalSearchParams } from 'expo-router';
import TeamChallengeAcceptScreen from '../../src/screens/TeamChallengeAcceptScreen';

export default function TeamChallengeAcceptRoute() {
  const params = useLocalSearchParams<{
    id: string;
    bookingId?: string;
    organizerTeamName?: string;
    challengedTeamName?: string;
    amountDue?: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TeamChallengeAcceptScreen
        challengeId={params.id ?? ''}
        bookingId={params.bookingId ?? ''}
        organizerTeamName={params.organizerTeamName}
        challengedTeamName={params.challengedTeamName}
        initialAmountDue={params.amountDue ? Number(params.amountDue) : undefined}
      />
    </>
  );
}
