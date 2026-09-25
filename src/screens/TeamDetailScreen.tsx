import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check, Shield, Swords, Trash2, UserMinus, UserPlus, X } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { teamApi } from '../api/teamApi';
import { Team, TeamChallenge } from '../types/api';
import { resolveMediaUrl, resolveAvatarUri } from '../utils/mediaUrl';
import { extractApiError } from '../utils/apiError';
import { LoadingScreen } from '../components/LoadingScreen';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';
import { AddTeamMemberSheet } from '../components/team/AddTeamMemberSheet';
import { TeamSearchSheet } from '../components/team/TeamSearchSheet';
import { goBack } from '../utils/navigation';

interface TeamDetailScreenProps {
  teamId: string;
}

/**
 * A persistent Team's roster + challenges - captain manages members and can
 * challenge another team; the challenged team's captain accepts/declines
 * from here too. Purely a request/response record on accept - venue/time
 * arrangement is manual afterwards through the existing create-match flow
 * (see TeamService.respondToChallenge on the backend for the same note).
 */
export default function TeamDetailScreen({ teamId }: TeamDetailScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const myUid = user?.firebaseUid;

  const [team, setTeam] = useState<Team | null>(null);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [challenges, setChallenges] = useState<TeamChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMemberVisible, setAddMemberVisible] = useState(false);
  const [teamSearchVisible, setTeamSearchVisible] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [busyChallengeId, setBusyChallengeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, challengesRes, myTeamsRes] = await Promise.all([
        teamApi.getTeam(teamId),
        teamApi.getChallengesForTeam(teamId),
        myUid ? teamApi.getMyTeams() : Promise.resolve<Team[]>([]),
      ]);
      setTeam(teamRes);
      setChallenges(challengesRes);
      setMyTeams(myTeamsRes);
    } catch (err) {
      Alert.alert('Could not load team', extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [teamId, myUid]);

  useEffect(() => { load(); }, [load]);

  const isCaptain = !!team && !!myUid && team.captainFirebaseUid === myUid;
  // Every OTHER team I captain - used to offer a quick "Challenge This Team"
  // shortcut and to show the challenge status between the two, when I'm
  // viewing a team I don't captain myself.
  const myOtherCaptainedTeams = useMemo(
    () => myTeams.filter((t) => t.id !== teamId && t.captainFirebaseUid === myUid),
    [myTeams, teamId, myUid]
  );

  const handleAddMember = async (u: { firebaseUid: string }) => {
    const updated = await teamApi.addMember(teamId, u.firebaseUid);
    setTeam(updated);
  };

  const handleRemoveMember = (uid: string, name: string) => {
    Alert.alert(`Remove ${name}?`, 'They will no longer be part of this team.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyUid(uid);
          try {
            const updated = await teamApi.removeMember(teamId, uid);
            setTeam(updated);
          } catch (err) {
            Alert.alert('Could not remove player', extractApiError(err));
          } finally {
            setBusyUid(null);
          }
        },
      },
    ]);
  };

  const handleDeleteTeam = () => {
    Alert.alert('Delete this team?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await teamApi.deleteTeam(teamId);
            goBack(router);
          } catch (err) {
            Alert.alert('Could not delete team', extractApiError(err));
          }
        },
      },
    ]);
  };

  // challengerTeamId is whichever team I'M captaining that is doing the
  // challenging - the page's own team when I'm this team's captain (the
  // "Challenge a Team" button flow), or one of myOtherCaptainedTeams when
  // I'm browsing a team I don't captain (the "Challenge This Team" shortcut).
  const sendChallenge = async (challengerTeamId: string, challengedTeamId: string) => {
    try {
      await teamApi.sendChallenge(challengedTeamId, { challengerTeamId });
      Alert.alert('Challenge sent', 'The other team’s captain has been notified.');
      const fresh = await teamApi.getChallengesForTeam(teamId);
      setChallenges(fresh);
    } catch (err) {
      Alert.alert('Could not send challenge', extractApiError(err));
    }
  };

  const handleSelectOpponent = (opponent: Team) => {
    setTeamSearchVisible(false);
    sendChallenge(teamId, opponent.id);
  };

  const handleRespond = async (challengeId: string, accept: boolean) => {
    setBusyChallengeId(challengeId);
    try {
      await teamApi.respondToChallenge(challengeId, accept);
      const fresh = await teamApi.getChallengesForTeam(teamId);
      setChallenges(fresh);
    } catch (err) {
      Alert.alert('Could not respond', extractApiError(err));
    } finally {
      setBusyChallengeId(null);
    }
  };

  if (loading || !team) {
    return <LoadingScreen message="Loading team..." />;
  }

  const logoUri = resolveMediaUrl(team.logoUrl);
  const pendingReceived = challenges.filter((c) => c.status === 'PENDING' && c.challengedTeamId === teamId);
  const otherChallenges = challenges.filter((c) => !pendingReceived.includes(c));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenGlow />
      <View style={styles.topHeaderShadow}>
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGlassStroke} pointerEvents="none" />
          <HeaderIconButton onPress={() => goBack(router)} style={styles.headerIconBtn} hitSlop={8}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
          </HeaderIconButton>
          <Text style={styles.title} numberOfLines={1}>{team.name}</Text>
          {isCaptain ? (
            <HeaderIconButton onPress={handleDeleteTeam} style={styles.headerIconBtn} hitSlop={8}>
              <Trash2 color={colors.white} size={18} strokeWidth={2.2} />
            </HeaderIconButton>
          ) : (
            <View style={styles.headerIconBtn} />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logo} />
          ) : (
            <View style={styles.logoFallback}>
              <Shield color={colors.primary} size={36} strokeWidth={1.8} />
            </View>
          )}
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={styles.teamMeta}>{team.sport} · {team.members.length} {team.members.length === 1 ? 'player' : 'players'}</Text>
        </View>

        {isCaptain && (
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn} onPress={() => setAddMemberVisible(true)}>
              <UserPlus color={colors.white} size={15} strokeWidth={2.4} />
              <Text style={styles.actionBtnText}>Add Member</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.challengeBtn]} onPress={() => setTeamSearchVisible(true)}>
              <Swords color={colors.white} size={15} strokeWidth={2.4} />
              <Text style={styles.actionBtnText}>Challenge a Team</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ROSTER</Text>
          {team.members.map((m) => {
            const avatarUri = resolveAvatarUri(m.profileImageUrl, m.displayName);
            return (
              <View key={m.firebaseUid} style={styles.memberRow}>
                <Image source={{ uri: avatarUri }} style={styles.memberAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName} numberOfLines={1}>{m.displayName}</Text>
                  {m.captain && <Text style={styles.captainTag}>CAPTAIN</Text>}
                </View>
                {isCaptain && !m.captain && (
                  busyUid === m.firebaseUid ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Pressable onPress={() => handleRemoveMember(m.firebaseUid, m.displayName)} hitSlop={8}>
                      <UserMinus color={colors.error} size={17} strokeWidth={2} />
                    </Pressable>
                  )
                )}
              </View>
            );
          })}
        </View>

        {isCaptain && pendingReceived.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CHALLENGES RECEIVED</Text>
            {pendingReceived.map((c) => (
              <View key={c.id} style={styles.challengeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.challengeText}>{c.challengerTeamName || 'A team'} challenged you</Text>
                  {!!c.message && <Text style={styles.challengeMessage}>&quot;{c.message}&quot;</Text>}
                </View>
                {busyChallengeId === c.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={styles.challengeActions}>
                    <Pressable style={styles.acceptBtn} onPress={() => handleRespond(c.id, true)}>
                      <Check color={colors.white} size={14} strokeWidth={2.6} />
                    </Pressable>
                    <Pressable style={styles.declineBtn} onPress={() => handleRespond(c.id, false)}>
                      <X color={colors.white} size={14} strokeWidth={2.6} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {isCaptain && otherChallenges.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CHALLENGE HISTORY</Text>
            {otherChallenges.map((c) => (
              <ChallengeHistoryRow key={c.id} challenge={c} teamId={teamId} colors={colors} styles={styles} />
            ))}
          </View>
        )}

        {!isCaptain && myOtherCaptainedTeams.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>YOUR TEAMS VS {team.name.toUpperCase()}</Text>
            {myOtherCaptainedTeams.map((mine) => {
              const existing = challenges.find(
                (c) => c.challengerTeamId === mine.id || c.challengedTeamId === mine.id
              );
              return (
                <View key={mine.id} style={styles.challengeRow}>
                  <Text style={styles.challengeText}>{mine.name}</Text>
                  {existing ? (
                    <Text style={styles.challengeStatus}>{existing.status}</Text>
                  ) : (
                    <Pressable style={styles.smallChallengeBtn} onPress={() => sendChallenge(mine.id, team.id)}>
                      <Swords color={colors.white} size={12} strokeWidth={2.4} />
                      <Text style={styles.smallChallengeBtnText}>Challenge</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AddTeamMemberSheet
        visible={addMemberVisible}
        onClose={() => setAddMemberVisible(false)}
        onAdd={handleAddMember}
        excludeUids={team.members.map((m) => m.firebaseUid)}
      />
      <TeamSearchSheet
        visible={teamSearchVisible}
        onClose={() => setTeamSearchVisible(false)}
        onSelect={handleSelectOpponent}
        excludeTeamId={teamId}
      />
    </SafeAreaView>
  );
}

// Small helper row for a captain's full challenge history (sent + responded)
// - kept outside the main component since it needs no state of its own.
function ChallengeHistoryRow({
  challenge, teamId, colors, styles,
}: {
  challenge: TeamChallenge;
  teamId: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const sent = challenge.challengerTeamId === teamId;
  const otherName = sent ? challenge.challengedTeamName : challenge.challengerTeamName;
  return (
    <View style={styles.challengeRow}>
      <Text style={styles.challengeText}>
        {sent ? `You challenged ${otherName || 'a team'}` : `${otherName || 'A team'} challenged you`}
      </Text>
      <Text style={styles.challengeStatus}>{challenge.status}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topHeaderShadow: {
    marginHorizontal: 12, marginTop: 6, marginBottom: 2, borderRadius: 26,
    shadowColor: colors.primaryDark, shadowOpacity: 0.28, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 26, overflow: 'hidden',
  },
  headerGlassStroke: {
    ...StyleSheet.absoluteFillObject, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  title: { flex: 1, marginHorizontal: 10, fontSize: 17, fontWeight: '800', color: colors.white, textAlign: 'center' },

  scroll: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 16 },

  heroSection: { alignItems: 'center', marginBottom: 18 },
  logo: {
    width: 88, height: 88, borderRadius: 44, marginBottom: 10,
    borderWidth: 3, borderColor: colors.white,
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  logoFallback: {
    width: 88, height: 88, borderRadius: 44, marginBottom: 10,
    backgroundColor: colors.primary + '18', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.white,
  },
  teamName: { fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center' },
  teamMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '600' },

  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: 14, backgroundColor: colors.primary,
  },
  challengeBtn: { backgroundColor: colors.neutral900 },
  actionBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  card: {
    backgroundColor: colors.cardBg, borderRadius: 20, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  sectionLabel: {
    fontSize: 10.5, fontWeight: '700', letterSpacing: 1.4, color: colors.neutral500,
    textTransform: 'uppercase', marginBottom: 12,
  },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.neutral100 },
  memberName: { fontSize: 14, fontWeight: '600', color: colors.text },
  captainTag: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.6, marginTop: 1 },

  challengeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, gap: 10 },
  challengeText: { fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 },
  challengeMessage: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  challengeStatus: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5 },
  challengeActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  smallChallengeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  smallChallengeBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});
