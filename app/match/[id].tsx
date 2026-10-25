import { Stack, useLocalSearchParams } from 'expo-router';
import MatchDetailsScreen from '../../src/screens/MatchDetailsScreen';

export default function MatchRoute() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  // Set when opened from an invitation notification/push — shows the invitation card.
  const rawInvitation = Array.isArray(params.invitationId) ? params.invitationId[0] : params.invitationId;
  const invitationId = typeof rawInvitation === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(rawInvitation) ? rawInvitation : undefined;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MatchDetailsScreen matchId={id ?? ''} invitationId={invitationId} />
    </>
  );
}
