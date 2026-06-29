import { useLocalSearchParams } from 'expo-router';
import JoinCheckoutScreen from '../../src/screens/JoinCheckoutScreen';

export default function JoinCheckoutRoute() {
  const { id, additionalPlayers, invitationId } = useLocalSearchParams<{
    id: string;
    additionalPlayers?: string;
    invitationId?: string;
  }>();
  const additionalPlayerIds: string[] = additionalPlayers
    ? JSON.parse(additionalPlayers as string)
    : [];
  return (
    <JoinCheckoutScreen
      matchId={id}
      additionalPlayerIds={additionalPlayerIds}
      invitationId={invitationId as string | undefined}
    />
  );
}
