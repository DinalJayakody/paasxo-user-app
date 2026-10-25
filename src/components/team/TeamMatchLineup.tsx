import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Clock, Crown, Shield, Swords, UserPlus, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { openProfile } from '../../utils/openProfile';
import { ThemeColors, Colors } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { teamApi } from '../../api/teamApi';
import { teamMatchApi } from '../../api/teamMatchApi';
import { MatchDetails, Team, TeamMatchChallenge, TeamMemberSummary } from '../../types/api';
import { confirmDeclineChallenge, openAcceptChallenge } from '../../utils/teamChallengeActions';
import { resolveAvatarUri, resolveMediaUrl } from '../../utils/mediaUrl';
import { teamMatchSportLabel } from '../../constants/teamMatchSports';

/**
 * Loads the two teams of a Team Match Challenge each time the match itself is
 * (re)loaded — shared by the banner and the lineup on the match screen so the
 * teams are fetched a single time per load, not once per component.
 */
export function useMatchTeams(match: MatchDetails) {
  const [organizerTeam, setOrganizerTeam] = useState<Team | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<Team | null>(null);
  // A direct challenge still awaiting the challenged team's half (only returned
  // to players on either team) and that team's roster.
  const [pendingChallenge, setPendingChallenge] = useState<TeamMatchChallenge | null>(null);
  const [challengedTeam, setChallengedTeam] = useState<Team | null>(null);

  useEffect(() => {
    let cancelled = false;
    const awaitingDirectOpponent = !!match.organizerTeamId && !match.opponentTeamId
      && !match.openTeamChallenge && match.status !== 'CANCELLED';
    if (awaitingDirectOpponent) {
      teamMatchApi.getPendingChallengeForMatch(match.id)
        .then((c) => {
          if (cancelled) return;
          setPendingChallenge(c);
          if (c) teamApi.getTeam(c.challengedTeamId).then((t) => !cancelled && setChallengedTeam(t)).catch(() => {});
          else setChallengedTeam(null);
        })
        .catch(() => { if (!cancelled) { setPendingChallenge(null); setChallengedTeam(null); } });
    } else {
      setPendingChallenge(null);
      setChallengedTeam(null);
    }
    if (match.organizerTeamId) {
      teamApi.getTeam(match.organizerTeamId).then((t) => !cancelled && setOrganizerTeam(t)).catch(() => {});
    } else {
      setOrganizerTeam(null);
    }
    if (match.opponentTeamId) {
      teamApi.getTeam(match.opponentTeamId).then((t) => !cancelled && setOpponentTeam(t)).catch(() => {});
    } else {
      setOpponentTeam(null);
    }
    return () => { cancelled = true; };
    // Keyed on the match object itself: it's replaced only when the screen loads
    // the match (first open, pull-to-refresh, after an action), so rosters are
    // re-fetched exactly then — never on unrelated re-renders.
  }, [match]);

  return { organizerTeam, opponentTeam, pendingChallenge, challengedTeam };
}

interface LineupProps {
  match: MatchDetails;
  organizerTeam: Team | null;
  opponentTeam: Team | null;
  // Shown on the open slot for viewers who can take the match on.
  canTakeOn?: boolean;
  pendingChallenge?: TeamMatchChallenge | null;
  challengedTeam?: Team | null;
  // The viewer captains the challenged team -> Accept / Decline shown here.
  isChallengedCaptain?: boolean;
  // Reload the match after a decline (it cancels the booking).
  onChanged?: () => void;
}

/**
 * Team-vs-team lineup for a Team Match Challenge — replaces the individual
 * "Participants" list, since these matches are played between two whole team
 * rosters (home = the team that booked, away = the team that took it on).
 */
export function TeamMatchLineup({
  match, organizerTeam, opponentTeam, canTakeOn, pendingChallenge, challengedTeam, isChallengedCaptain, onChanged,
}: LineupProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const sportLabel = teamMatchSportLabel(match.sportType);
  const half = match.totalPrice != null ? `LKR ${(match.totalPrice / 2).toFixed(2)}` : 'half the cost';
  const isCancelled = match.status === 'CANCELLED';

  return (
    <View style={styles.wrap}>
      <TeamSide label="HOME · BOOKED THE MATCH" team={organizerTeam} accent={colors.primary} styles={styles} colors={colors} />

      <View style={styles.vsRow}>
        <View style={styles.vsLine} />
        <View style={styles.vsBadge}>
          <Swords color={colors.white} size={14} strokeWidth={2.4} />
          <Text style={styles.vsText}>VS</Text>
        </View>
        <View style={styles.vsLine} />
      </View>

      {match.opponentTeamId ? (
        <TeamSide label="AWAY · TOOK IT ON" team={opponentTeam} accent={colors.success} styles={styles} colors={colors} />
      ) : pendingChallenge && !isCancelled ? (
        <View>
          <TeamSide
            label="AWAY · CHALLENGED — YET TO ACCEPT"
            team={challengedTeam ?? null}
            accent={colors.warning}
            styles={styles}
            colors={colors}
          />
          <View style={[styles.challengeNote, { borderColor: colors.warning + '40', backgroundColor: colors.warning + '12' }]}>
            <Clock color={colors.warning} size={14} strokeWidth={2.2} />
            <Text style={styles.challengeNoteText}>
              {isChallengedCaptain
                ? pendingChallenge.venueConfirmed === false
                  ? `You'll be able to accept once the venue confirms the booking. Your half: LKR ${Number(pendingChallenge.amountDue).toFixed(2)}.`
                  : `Accept by paying your team's half — LKR ${Number(pendingChallenge.amountDue).toFixed(2)}. The same amount goes back to ${organizerTeam?.name ?? 'the home team'}, so both teams pay equally.`
                : `Confirmed once ${challengedTeam?.name ?? 'the challenged team'}'s captain pays their half (LKR ${Number(pendingChallenge.amountDue).toFixed(2)}).`}
            </Text>
          </View>
          {isChallengedCaptain && (
            <View style={styles.challengeActions}>
              <Pressable
                style={[styles.declineBtn, { borderColor: colors.error + '66' }]}
                onPress={() => confirmDeclineChallenge(pendingChallenge, () => onChanged?.())}
              >
                <X color={colors.error} size={15} strokeWidth={2.4} />
                <Text style={[styles.declineText, { color: colors.error }]}>Decline</Text>
              </Pressable>
              <Pressable
                style={[styles.takeOnBtn, styles.acceptBtn, pendingChallenge.venueConfirmed === false && { opacity: 0.5 }]}
                onPress={() => openAcceptChallenge(router, pendingChallenge)}
              >
                <Swords color={Colors.white} size={15} strokeWidth={2.4} />
                <Text style={styles.takeOnText}>Accept · Pay half</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.openSlot}>
          <View style={styles.openSlotIcon}>
            <UserPlus color={colors.primary} size={20} strokeWidth={2.2} />
          </View>
          <Text style={styles.openSlotTitle}>
            {isCancelled ? 'No opponent' : match.openTeamChallenge ? 'Open spot for a team' : 'Waiting for the challenged team'}
          </Text>
          {!isCancelled && (
            <Text style={styles.openSlotText}>
              {match.openTeamChallenge
                ? `Any ${sportLabel} team can take this on. Their captain pays ${half} — the same amount is refunded to the home team, so both teams pay equally.`
                : `The challenged team confirms by paying ${half}.`}
            </Text>
          )}
          {canTakeOn && (
            <Pressable
              style={styles.takeOnBtn}
              onPress={() => router.push({
                pathname: `/team-match-join/${match.id}` as any,
                params: organizerTeam ? { organizerTeamName: organizerTeam.name } : {},
              })}
            >
              <Swords color={Colors.white} size={15} strokeWidth={2.4} />
              <Text style={styles.takeOnText}>Take it on with your team</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function TeamSide({ label, team, accent, styles, colors }: {
  label: string;
  team: Team | null;
  accent: string;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const logo = resolveMediaUrl(team?.logoUrl) ?? null;
  // Captain first, then everyone else alphabetically.
  const members: TeamMemberSummary[] = useMemo(() => [...(team?.members ?? [])].sort((a, b) =>
    a.captain === b.captain ? (a.displayName || '').localeCompare(b.displayName || '') : a.captain ? -1 : 1
  ), [team?.members]);

  return (
    <View style={[styles.side, { borderColor: accent + '40' }]}>
      <Text style={[styles.sideLabel, { color: accent }]}>{label}</Text>
      {/* Team header -> the team's page; each player -> their profile. */}
      <Pressable
        style={styles.sideHeader}
        disabled={!team}
        onPress={() => team && router.push(`/team/${team.id}` as any)}
        accessibilityRole="button"
        accessibilityLabel={team ? `Open team ${team.name}` : undefined}
      >
        {logo ? (
          <Image source={{ uri: logo }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoFallback, { backgroundColor: accent + '1A' }]}>
            <Shield color={accent} size={20} strokeWidth={2} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.teamName} numberOfLines={1}>{team?.name ?? 'Loading team…'}</Text>
          {team && (
            <Text style={styles.teamMeta}>
              {members.length} {members.length === 1 ? 'player' : 'players'}
            </Text>
          )}
        </View>
        {team && <ChevronRight color={colors.neutral400} size={18} strokeWidth={2} />}
      </Pressable>
      {members.map((m) => (
        <Pressable
          key={m.firebaseUid}
          style={({ pressed }) => [styles.memberRow, pressed && { opacity: 0.6 }]}
          onPress={() => openProfile(router, m.firebaseUid, user?.firebaseUid)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${m.displayName || 'player'}'s profile`}
        >
          <Image source={{ uri: resolveAvatarUri(m.profileImageUrl, m.displayName) }} style={styles.memberAvatar} />
          <Text style={styles.memberName} numberOfLines={1}>
            {m.displayName || 'Player'}{m.firebaseUid === user?.firebaseUid ? ' (you)' : ''}
          </Text>
          {m.captain && (
            <View style={[styles.captainBadge, { backgroundColor: colors.warning + '22' }]}>
              <Crown color={colors.warning} size={11} strokeWidth={2.4} />
              <Text style={[styles.captainText, { color: colors.warning }]}>Captain</Text>
            </View>
          )}
          <ChevronRight color={colors.neutral400} size={16} strokeWidth={2} />
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 8 },
  side: {
    backgroundColor: colors.cardBg, borderRadius: 18, padding: 14, borderWidth: 1.5,
  },
  sideLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 10 },
  sideHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  logo: { width: 46, height: 46, borderRadius: 23 },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  teamName: { fontSize: 16, fontWeight: '800', color: colors.text },
  teamMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.neutral200,
  },
  memberAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.neutral100 },
  memberName: { flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.text },
  captainBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  captainText: { fontSize: 10.5, fontWeight: '800' },

  vsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  vsLine: { flex: 1, height: 1, backgroundColor: colors.neutral200 },
  vsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6,
  },
  vsText: { color: colors.white, fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  openSlot: {
    alignItems: 'center', gap: 6, borderRadius: 18, padding: 18,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary + '66',
    backgroundColor: colors.primary + '0A',
  },
  openSlotIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary + '1A',
  },
  openSlotTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  openSlotText: { fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  takeOnBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6,
    backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11,
  },
  takeOnText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  challengeNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 10,
  },
  challengeNoteText: { flex: 1, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },
  challengeActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  acceptBtn: { flex: 1, justifyContent: 'center', marginTop: 0 },
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11,
  },
  declineText: { fontSize: 14, fontWeight: '800' },
});
