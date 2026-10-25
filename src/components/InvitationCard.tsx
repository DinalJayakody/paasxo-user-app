import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CreditCard, Info, Mail } from 'lucide-react-native';
import { ThemeColors, Colors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { invitationApi, InvitationResponse } from '../api/invitationApi';
import { extractApiError } from '../utils/apiError';

interface Props {
  invitationId: string;
  bookingId: string;
  myUid?: string | null;
  /** The match's organizer, to say who invited you when it was them. */
  organizerUid?: string | null;
  organizerName?: string | null;
  /** Reload the match after joining (player list / button state change). */
  onChanged: () => void;
}

const PENDING = new Set(['REQUEST_SENT', 'VIEWED']);
const AWAITING_PAYMENT = new Set(['ACCEPTED_AWAITING_PAYMENT', 'PAYMENT_IN_PROGRESS', 'PAYMENT_FAILED']);
const ENDED_COPY: Record<string, string> = {
  DECLINED: 'You declined this invitation.',
  EXPIRED: 'This invitation has expired.',
  MATCH_FULL: 'This match filled up before you could join.',
  MATCH_CANCELLED: 'This match was cancelled.',
  AUTO_CANCELLED: 'This invitation is no longer active.',
};

/**
 * An invitation to this match, opened from an invitation notification or push
 * (/match/{id}?invitationId=...). Lets the invited player accept (and pay, for a
 * paid match) or decline right here. Shown only to the invitation's recipient,
 * for this match — the server also refuses the lookup to anyone but the
 * invitation's sender/recipient.
 */
export function InvitationCard({ invitationId, bookingId, myUid, organizerUid, organizerName, onChanged }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    try {
      const inv = await invitationApi.getById(invitationId);
      if (mounted.current) setInvitation(inv);
    } catch {
      if (mounted.current) setInvitation(null); // not ours / gone — show nothing
    }
  }, [invitationId]);

  useEffect(() => { load(); }, [load]);

  if (!invitation || !myUid) return null;
  if (String(invitation.bookingId) !== String(bookingId)) return null;
  if (invitation.recipientFirebaseUid !== myUid) return null;
  if (invitation.status === 'JOIN_COMPLETED') return null; // already in the match

  const goToCheckout = () =>
    router.push(`/join-checkout/${encodeURIComponent(bookingId)}?invitationId=${encodeURIComponent(invitation.id)}` as any);

  const handleAccept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await invitationApi.accept(invitation.id);
      if (res.requiresPayment) {
        goToCheckout();
      } else {
        Alert.alert("You're in!", res.message || 'You have joined the match.');
        onChanged();
      }
      await load();
    } catch (err) {
      Alert.alert('Could not accept', extractApiError(err, 'Please try again.'));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const handleDecline = () => {
    if (busy) return;
    Alert.alert('Decline invitation?', "You won't be added to this match.", [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Decline', style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            await invitationApi.decline(invitation.id);
            await load();
          } catch (err) {
            Alert.alert('Could not decline', extractApiError(err, 'Please try again.'));
          } finally {
            if (mounted.current) setBusy(false);
          }
        },
      },
    ]);
  };

  const inviter = invitation.senderFirebaseUid && invitation.senderFirebaseUid === organizerUid && organizerName
    ? organizerName : null;

  if (PENDING.has(invitation.status)) {
    return (
      <View style={[styles.card, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '38' }]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.primary + '22' }]}>
            <Mail color={colors.primary} size={18} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.primary }]}>You're invited to this match</Text>
            <Text style={styles.text}>
              {inviter ? `${inviter} invited you. ` : ''}Check the details below, then accept to take your spot or decline.
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable style={[styles.secondaryBtn, { borderColor: colors.error + '66' }]} onPress={handleDecline} disabled={busy}>
            <Text style={[styles.secondaryText, { color: colors.error }]}>Decline</Text>
          </Pressable>
          <Pressable style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={handleAccept} disabled={busy}>
            {busy ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.primaryText}>Accept</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  if (AWAITING_PAYMENT.has(invitation.status)) {
    return (
      <View style={[styles.card, { backgroundColor: colors.warning + '12', borderColor: colors.warning + '40' }]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.warning + '22' }]}>
            <CreditCard color={colors.warning} size={18} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.warning }]}>Complete payment to join</Text>
            <Text style={styles.text}>You accepted this invitation — pay your share to secure your spot.</Text>
          </View>
        </View>
        <Pressable style={[styles.primaryBtn, { marginTop: 12 }]} onPress={goToCheckout}>
          <Text style={styles.primaryText}>Pay now</Text>
        </Pressable>
      </View>
    );
  }

  const ended = ENDED_COPY[invitation.status];
  if (!ended) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.neutral100, borderColor: colors.neutral200 }]}>
      <View style={styles.row}>
        <Info color={colors.textMuted} size={16} strokeWidth={2.2} />
        <Text style={[styles.text, { flex: 1 }]}>{ended}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13.5, fontWeight: '800', marginBottom: 3 },
  text: { fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primaryBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 11,
  },
  primaryText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  secondaryBtn: {
    alignItems: 'center', justifyContent: 'center', minHeight: 42,
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 18,
  },
  secondaryText: { fontSize: 14, fontWeight: '800' },
});
