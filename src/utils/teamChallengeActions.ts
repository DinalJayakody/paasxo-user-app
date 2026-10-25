import { Alert } from 'react-native';
import type { Router } from 'expo-router';
import { teamMatchApi } from '../api/teamMatchApi';
import { TeamMatchChallenge } from '../types/api';
import { extractApiError } from './apiError';

/**
 * Accept / Decline for a direct Team Match Challenge — shared by the match
 * screen and the Team vs Team "Challenges" tab so both behave identically.
 */

const money = (n?: number | null) => `LKR ${Number(n ?? 0).toFixed(2)}`;

/** Opens the pay-your-half screen. Accepting is only possible once the venue
 *  has confirmed the booking (the server enforces this too). */
export function openAcceptChallenge(router: Router, c: TeamMatchChallenge) {
  if (c.venueConfirmed === false) {
    Alert.alert(
      'Waiting for the venue',
      "The venue hasn't confirmed this booking yet. You'll be able to accept as soon as it does — nothing is charged until then.",
    );
    return;
  }
  router.push({
    pathname: `/team-challenge-accept/${c.id}` as any,
    params: {
      bookingId: String(c.bookingId),
      organizerTeamName: c.organizerTeamName ?? '',
      challengedTeamName: c.challengedTeamName ?? '',
      amountDue: String(c.amountDue),
    },
  });
}

/** Confirms, then declines. Declining cancels the challenger's booking and
 *  refunds them in full — the confirmation says so. */
export function confirmDeclineChallenge(c: TeamMatchChallenge, onDone: () => void) {
  Alert.alert(
    'Decline this challenge?',
    `${c.organizerTeamName ?? 'The other team'}'s booking will be cancelled and they'll be refunded in full. Your team pays nothing.`,
    [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          try {
            await teamMatchApi.declineChallenge(c.id);
            onDone();
          } catch (err) {
            Alert.alert('Could not decline', extractApiError(err, 'Please try again.'));
          }
        },
      },
    ],
  );
}

export const challengeHalfLabel = (c: TeamMatchChallenge) => money(c.amountDue);
