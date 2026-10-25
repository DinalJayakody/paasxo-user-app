import { TeamSearchSheet } from '../components/team/TeamSearchSheet';
import { teamApi } from '../api/teamApi';
import { extractApiError } from '../utils/apiError';
import { Team } from '../types/api';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Animated,
  Share,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Share2,
  MapPin,
  Calendar,
  Plus,
  Radio,
  CircleCheckBig,
  Crown,
  X,
  Swords,
} from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { tournamentApi } from '../api/tournamentApi';
import { futsalApi } from '../api/futsalApi';
import { tournamentStorage } from '../utils/tournamentStorage';
import { buildTeamUI, buildMatchUI, buildTournamentUI } from '../utils/parseTournament';
import { TournamentUI, TournamentTeamUI } from '../types/api';
import { LoadingScreen } from '../components/LoadingScreen';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';
import ShareToCommunityModal from '../components/ShareToCommunityModal';
import { goBack } from '../utils/navigation';
import { openProfile } from '../utils/openProfile';

interface TournamentDetailsScreenProps {
  tournamentId: string;
}

export default function TournamentDetailsScreen({ tournamentId }: TournamentDetailsScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [tournament, setTournament] = useState<TournamentUI | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rosterTeam, setRosterTeam] = useState<TournamentTeamUI | null>(null);
  const [showCommunityShare, setShowCommunityShare] = useState(false);

  const [addTeamVisible, setAddTeamVisible] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);

  const [addMatchVisible, setAddMatchVisible] = useState(false);
  const [matchTeamA, setMatchTeamA] = useState<number | null>(null);
  const [matchTeamB, setMatchTeamB] = useState<number | null>(null);
  const [addingMatch, setAddingMatch] = useState(false);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [loadError, setLoadError] = useState<string | null>(null);
  // Teams I captain — for "Join with my team" and accepting invitations.
  const [myCaptainedTeams, setMyCaptainedTeams] = useState<Team[]>([]);
  const [busyTeamAction, setBusyTeamAction] = useState(false);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);

  useEffect(() => {
    if (!user?.firebaseUid) return;
    teamApi.getMyTeams()
      .then((ts) => setMyCaptainedTeams(ts.filter((t) => t.captainFirebaseUid === user.firebaseUid)))
      .catch(() => setMyCaptainedTeams([]));
  }, [user?.firebaseUid]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // The tournament itself must load; teams/fixtures degrade to empty
      // rather than leaving the whole page stuck on a spinner.
      const record = await tournamentApi.getTournament(tournamentId);
      const [teamsRes, matchesRes] = await Promise.allSettled([
        tournamentApi.listTeams(tournamentId),
        tournamentApi.listMatches(tournamentId),
      ]);
      const teamRecords = teamsRes.status === 'fulfilled' && Array.isArray(teamsRes.value) ? teamsRes.value : [];
      const matchRecords = matchesRes.status === 'fulfilled' && Array.isArray(matchesRes.value) ? matchesRes.value : [];
      setLoadError(null);

      const teamsWithPlayers = await Promise.all(
        teamRecords.map(async (team: any) => {
          try {
            const players = await tournamentApi.listPlayers(tournamentId, team.id);
            return buildTeamUI(team, players);
          } catch {
            return buildTeamUI(team, []);
          }
        })
      );

      const overrides = await tournamentStorage.getMatchOverrides(tournamentId);
      const teamMap = new Map(teamsWithPlayers.map((t) => [t.id, t]));
      const matchesUI = matchRecords.map((m: any) => buildMatchUI(m, teamMap, overrides[String(m.id)]));

      let venueName: string | undefined;
      try {
        const venue = await futsalApi.getById(record.futsalId);
        venueName = venue?.name;
      } catch {
        venueName = undefined;
      }

      const isOwner = !!user && record.createdBy === user.firebaseUid;
      const ui = buildTournamentUI({ tournament: record, teams: teamsWithPlayers, matches: matchesUI, venueName, isOwner });
      setTournament(ui);

      await tournamentStorage.track({
        id: record.id,
        futsalId: record.futsalId,
        name: record.name,
        role: isOwner ? 'owner' : 'viewer',
      });
    } catch (err: any) {
      if (!silent || !tournament) {
        setLoadError(err?.response?.status === 404 ? 'This tournament no longer exists.' : (err?.message || "Couldn't load this tournament."));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, user]);

  // ── Participation ──
  const runTeamAction = async (fn: () => Promise<unknown>, done: string) => {
    if (busyTeamAction) return;
    setBusyTeamAction(true);
    try {
      await fn();
      await load(true);
      Alert.alert(done);
    } catch (err) {
      Alert.alert('Something went wrong', extractApiError(err, 'Please try again.'));
    } finally {
      setBusyTeamAction(false);
    }
  };

  const handleJoinWithTeam = () => {
    if (!tournament) return;
    const inIds = new Set(tournament.teams.filter((t) => t.status !== 'DECLINED').map((t) => t.appTeamId).filter(Boolean));
    const eligible = myCaptainedTeams.filter((t) => !inIds.has(t.id));
    if (myCaptainedTeams.length === 0) {
      Alert.alert('Create a team first', 'Teams join tournaments together — create your team, add your players, then come back to join.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Create Team', onPress: () => router.push('/create-team' as any) },
      ]);
      return;
    }
    if (eligible.length === 0) {
      Alert.alert('Already in', 'Every team you captain is already in this tournament.');
      return;
    }
    const join = (team: Team) => runTeamAction(() => tournamentApi.joinWithTeam(tournamentId, team.id), `${team.name} joined the tournament!`);
    if (eligible.length === 1) {
      Alert.alert('Join tournament', `Enter ${eligible[0].name} into ${tournament.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Join', onPress: () => join(eligible[0]) },
      ]);
    } else {
      Alert.alert('Which team?', 'Pick the team to enter:', [
        ...eligible.slice(0, 5).map((t) => ({ text: t.name, onPress: () => join(t) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  const handleRemoveTeam = (team: { id: number; name: string; status?: string }, withdraw = false) => {
    Alert.alert(
      withdraw ? 'Withdraw your team?' : team.status === 'INVITED' ? 'Cancel invitation?' : 'Remove team?',
      withdraw ? `${team.name} will leave this tournament.` : `${team.name} will be removed from this tournament.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: withdraw ? 'Withdraw' : 'Remove', style: 'destructive',
          onPress: () => runTeamAction(() => tournamentApi.removeTeam(tournamentId, team.id), withdraw ? 'Your team has left the tournament.' : `${team.name} removed.`),
        },
      ],
    );
  };

  const handleInviteTeam = (team: Team) => {
    setInviteSheetVisible(false);
    runTeamAction(() => tournamentApi.inviteTeam(tournamentId, team.id), `Invitation sent to ${team.name}.`);
  };

  useEffect(() => {
    load();
  }, [load]);

  // Lightweight "live" polling - re-fetches matches while any match looks
  // live, simulating real-time updates since the backend has no push
  // channel or score endpoint yet (see tournamentApi.updateScore).
  useEffect(() => {
    if (tournament?.lifecycle !== 'LIVE') return;
    const interval = setInterval(() => load(true), 8000);
    return () => clearInterval(interval);
  }, [tournament?.lifecycle, load]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    setAddingTeam(true);
    try {
      await tournamentApi.createTeam(tournamentId, { name: newTeamName.trim() });
      setNewTeamName('');
      setAddTeamVisible(false);
      await load(true);
    } catch (err) {
      console.warn('Failed to add team', err);
    } finally {
      setAddingTeam(false);
    }
  };

  const handleAddMatch = async () => {
    if (matchTeamA == null || matchTeamB == null || matchTeamA === matchTeamB) return;
    setAddingMatch(true);
    try {
      await tournamentApi.createMatch(tournamentId, { teamAId: matchTeamA, teamBId: matchTeamB });
      setMatchTeamA(null);
      setMatchTeamB(null);
      setAddMatchVisible(false);
      await load(true);
    } catch (err) {
      console.warn('Failed to add match', err);
    } finally {
      setAddingMatch(false);
    }
  };

  const handleShareExternally = () => {
    if (!tournament) return;
    Share.share({
      message: `Follow "${tournament.name}" live on Paasxo! Tournament #${tournament.id} at ${tournament.venueName || 'the venue'}.`,
    }).catch(() => {});
  };

  const handleShare = () => {
    if (!tournament) return;
    Alert.alert('Share Tournament', undefined, [
      { text: 'Share to Community', onPress: () => setShowCommunityShare(true) },
      { text: 'Share Externally', onPress: handleShareExternally },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (loading && !tournament) {
    return <LoadingScreen message="Loading tournament…" />;
  }
  if (!tournament) {
    return (
      <SafeAreaView style={[styles.flex1, styles.errorWrap]} edges={['top']}>
        <Text style={styles.heroEmoji}>🏆</Text>
        <Text style={styles.errorTitle}>Couldn't open this tournament</Text>
        <Text style={styles.errorBody}>{loadError ?? 'Please check your connection and try again.'}</Text>
        <Pressable style={styles.errorRetry} onPress={() => load()} accessibilityRole="button">
          <Text style={styles.errorRetryText}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => goBack(router)} style={{ padding: 12 }} accessibilityRole="button">
          <Text style={styles.errorBack}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const joinedTeams = tournament.teams.filter((t) => !t.status || t.status === 'JOINED');
  const invitedTeams = tournament.teams.filter((t) => t.status === 'INVITED');
  const myInvites = invitedTeams.filter((t) => t.appTeamId && myCaptainedTeams.some((m) => m.id === t.appTeamId));
  const myJoinedTeam = joinedTeams.find((t) => t.appTeamId && myCaptainedTeams.some((m) => m.id === t.appTeamId));
  const isFull = tournament.maxTeams != null && joinedTeams.length >= tournament.maxTeams;
  const canJoin = !!tournament.isOpen && !tournament.isOwner && tournament.lifecycle === 'UPCOMING' && !myJoinedTeam && !isFull;

  const lifecycleConfig = {
    UPCOMING: { label: 'Upcoming', color: colors.neutral500, bg: colors.neutral200 },
    LIVE: { label: 'Live Now', color: '#DC2626', bg: '#FDE8E8' },
    COMPLETED: { label: 'Completed', color: colors.success, bg: '#E7F8EE' },
  }[tournament.lifecycle];

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <ScreenGlow />
      {/* Floating glass-gradient header */}
      <View style={styles.heroShadow}>
      <View style={styles.hero}>
        <LinearGradient
          colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerGlassStroke} pointerEvents="none" />

        <View style={styles.heroTopRow}>
          <HeaderIconButton style={styles.circleBtn} onPress={() => goBack(router)}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.5} />
          </HeaderIconButton>
          <HeaderIconButton style={styles.circleBtn} onPress={handleShare}>
            <Share2 color={colors.white} size={18} strokeWidth={2.5} />
          </HeaderIconButton>
        </View>
        <Text style={styles.heroEmoji}>🏆</Text>
        <Text style={styles.heroTitle}>{tournament.name}</Text>
        {tournament.venueName && (
          <View style={styles.heroMetaRow}>
            <MapPin color={colors.white} size={13} strokeWidth={2.5} />
            <Text style={styles.heroMetaText}>{tournament.venueName}</Text>
          </View>
        )}
        <View style={styles.heroMetaRow}>
          <Calendar color={colors.white} size={13} strokeWidth={2.5} />
          <Text style={styles.heroMetaText}>{tournament.date}</Text>
        </View>

        <View style={[styles.lifecycleBadge, { backgroundColor: lifecycleConfig.bg }]}>
          {tournament.lifecycle === 'LIVE' && (
            <Animated.View
              style={[
                styles.liveDot,
                { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
              ]}
            />
          )}
          <Text style={[styles.lifecycleBadgeText, { color: lifecycleConfig.color }]}>
            {lifecycleConfig.label}
          </Text>
        </View>
      </View>
      </View>

      <View style={styles.refreshableArea}>
      <PaasxoRefreshLogo refreshing={refreshing} />
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <PaasxoRefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
      >
        {/* Invitations for a team I captain */}
        {myInvites.map((inv) => (
          <View key={inv.id} style={styles.inviteBanner}>
            <Text style={styles.inviteBannerTitle}>{inv.name} is invited to this tournament</Text>
            <Text style={styles.inviteBannerSub}>Accept to enter your team — your current roster comes with it.</Text>
            <View style={styles.inviteBannerActions}>
              <Pressable
                style={[styles.inviteAccept, busyTeamAction && { opacity: 0.6 }]}
                disabled={busyTeamAction}
                onPress={() => runTeamAction(() => tournamentApi.respondToInvite(tournamentId, inv.id, true), `${inv.name} is in!`)}
              >
                <Text style={styles.inviteAcceptText}>Accept</Text>
              </Pressable>
              <Pressable
                style={[styles.inviteDecline, busyTeamAction && { opacity: 0.6 }]}
                disabled={busyTeamAction}
                onPress={() => runTeamAction(() => tournamentApi.respondToInvite(tournamentId, inv.id, false), 'Invitation declined.')}
              >
                <Text style={styles.inviteDeclineText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {/* Public tournament: enter with my team */}
        {(canJoin || myJoinedTeam || (tournament.isOpen && isFull && !tournament.isOwner)) && (
          <View style={styles.joinCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.joinCardTitle}>
                {myJoinedTeam ? `${myJoinedTeam.name} is in ✓` : isFull ? 'Tournament full' : 'Open to all teams'}
              </Text>
              <Text style={styles.joinCardSub}>
                {myJoinedTeam
                  ? 'Fixtures appear below once the organiser schedules them.'
                  : isFull
                    ? `All ${tournament.maxTeams} places are taken.`
                    : tournament.maxTeams != null
                      ? `${tournament.maxTeams - joinedTeams.length} of ${tournament.maxTeams} places left`
                      : 'Enter your team to compete.'}
              </Text>
            </View>
            {canJoin && (
              <Pressable style={[styles.joinBtn, busyTeamAction && { opacity: 0.6 }]} onPress={handleJoinWithTeam} disabled={busyTeamAction} accessibilityRole="button">
                {busyTeamAction ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.joinBtnText}>Join with my team</Text>}
              </Pressable>
            )}
            {!!myJoinedTeam && tournament.lifecycle === 'UPCOMING' && !tournament.isOwner && (
              <Pressable style={styles.withdrawBtn} onPress={() => handleRemoveTeam(myJoinedTeam, true)} disabled={busyTeamAction} accessibilityRole="button">
                <Text style={styles.withdrawBtnText}>Withdraw</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Teams ({joinedTeams.length}{tournament.maxTeams ? `/${tournament.maxTeams}` : ''})
          </Text>
          {tournament.isOwner && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={styles.addChip} onPress={() => setInviteSheetVisible(true)}>
                <Plus color={colors.primary} size={14} strokeWidth={2.5} />
                <Text style={[styles.addChipText, { color: colors.primary }]}>Invite Team</Text>
              </Pressable>
              <Pressable style={styles.addChip} onPress={() => setAddTeamVisible(true)}>
                <Plus color={colors.primary} size={14} strokeWidth={2.5} />
                <Text style={[styles.addChipText, { color: colors.primary }]}>By name</Text>
              </Pressable>
            </View>
          )}
        </View>

        {tournament.isOwner && invitedTeams.length > 0 && (
          <View style={styles.pendingWrap}>
            <Text style={styles.pendingInvites}>Waiting to accept:</Text>
            {invitedTeams.map((t) => (
              <View key={t.id} style={styles.pendingRow}>
                <Text style={styles.pendingName} numberOfLines={1}>{t.name} · {t.players.length} player{t.players.length === 1 ? '' : 's'}</Text>
                <Pressable onPress={() => handleRemoveTeam(t)} hitSlop={8}><Text style={styles.pendingCancel}>Cancel invite</Text></Pressable>
              </View>
            ))}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamsRow}>
          {joinedTeams.map((team) => (
            <Pressable key={team.id} style={[styles.teamCard, { borderColor: team.color }]} onPress={() => setRosterTeam(team)} onLongPress={tournament.isOwner ? () => handleRemoveTeam(team) : undefined}>
              {tournament.isOwner && tournament.lifecycle === 'UPCOMING' && (
                <Pressable onPress={() => handleRemoveTeam(team)} hitSlop={10} style={styles.teamCardRemove} accessibilityLabel={`Remove ${team.name}`}>
                  <X color={colors.textMuted} size={13} strokeWidth={2.6} />
                </Pressable>
              )}
              <Text style={styles.teamCardEmoji}>{team.emoji}</Text>
              <Text style={styles.teamCardName}>{team.name}</Text>
              <Text style={styles.teamCardMeta}>{team.players.length} player{team.players.length === 1 ? '' : 's'}</Text>
            </Pressable>
          ))}
          {joinedTeams.length === 0 && (
            <Text style={styles.emptyHint}>{tournament.isOpen ? 'No teams yet — be the first to join.' : 'No teams have joined yet.'}</Text>
          )}
        </ScrollView>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Fixtures ({tournament.matches.length})</Text>
          {tournament.isOwner && (
            <Pressable style={styles.addChip} onPress={() => setAddMatchVisible(true)}>
              <Plus color={colors.primary} size={14} strokeWidth={2.5} />
              <Text style={[styles.addChipText, { color: colors.primary }]}>Schedule</Text>
            </Pressable>
          )}
        </View>

        {tournament.matches.length === 0 ? (
          <Text style={styles.emptyHint}>No matches scheduled yet.</Text>
        ) : (
          tournament.matches.map((match) => {
            const statusConfig = {
              SCHEDULED: { label: 'Scheduled', color: colors.neutral500, bg: colors.neutral200 },
              LIVE: { label: 'Live', color: '#DC2626', bg: '#FDE8E8' },
              COMPLETED: { label: 'Final', color: colors.success, bg: '#E7F8EE' },
            }[match.derivedStatus];

            return (
              <Pressable
                key={match.id}
                style={styles.matchCard}
                onPress={() => router.push(`/tournament/${tournamentId}/match/${match.id}` as any)}
              >
                <View style={styles.matchCardTeam}>
                  <Text style={styles.matchCardEmoji}>{match.teamA?.emoji}</Text>
                  <Text style={styles.matchCardTeamName}>{match.teamA?.name || 'Team A'}</Text>
                </View>

                <View style={styles.matchCardScoreWrap}>
                  {match.teamAScore != null || match.teamBScore != null ? (
                    <Text style={styles.matchCardScore}>
                      {match.teamAScore ?? 0} - {match.teamBScore ?? 0}
                    </Text>
                  ) : (
                    <Swords color={colors.neutral400} size={18} strokeWidth={2} />
                  )}
                  <View style={[styles.matchStatusPill, { backgroundColor: statusConfig.bg }]}>
                    <Text style={[styles.matchStatusPillText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.matchCardTeam}>
                  <Text style={styles.matchCardTeamName}>{match.teamB?.name || 'Team B'}</Text>
                  <Text style={styles.matchCardEmoji}>{match.teamB?.emoji}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      </View>

      {/* Roster modal */}
      <Modal visible={!!rosterTeam} transparent animationType="fade" onRequestClose={() => setRosterTeam(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.modalClose} onPress={() => setRosterTeam(null)}>
              <X color={colors.text} size={18} strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.modalTeamEmoji}>{rosterTeam?.emoji}</Text>
            <Text style={styles.modalTitle}>{rosterTeam?.name}</Text>
            {rosterTeam?.players.length ? (
              rosterTeam.players.map((p) => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [styles.rosterRow, pressed && p.playerFirebaseUid ? { opacity: 0.6 } : null]}
                  disabled={!p.playerFirebaseUid}
                  onPress={() => { setRosterTeam(null); openProfile(router, p.playerFirebaseUid, user?.firebaseUid); }}
                  accessibilityRole="button"
                >
                  <Crown color={colors.primary} size={14} strokeWidth={2} />
                  <Text style={styles.rosterRowText}>{p.playerDisplayName || p.playerFirebaseUid}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyHint}>No players added to this team yet.</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Add team modal */}
      <Modal visible={addTeamVisible} transparent animationType="fade" onRequestClose={() => setAddTeamVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Pressable style={styles.modalClose} onPress={() => setAddTeamVisible(false)}>
              <X color={colors.text} size={18} strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.modalTitle}>Add a team</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Team name"
              placeholderTextColor={colors.neutral400}
              value={newTeamName}
              onChangeText={setNewTeamName}
            />
            <Pressable
              style={[styles.modalSubmit, addingTeam && styles.modalSubmitDisabled]}
              onPress={handleAddTeam}
              disabled={addingTeam}
            >
              {addingTeam ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalSubmitText}>Add Team</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add match modal */}
      <Modal visible={addMatchVisible} transparent animationType="fade" onRequestClose={() => setAddMatchVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.modalClose} onPress={() => setAddMatchVisible(false)}>
              <X color={colors.text} size={18} strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.modalTitle}>Schedule a match</Text>
            <View style={styles.teamChipRow}>
              {tournament.teams.map((team) => (
                <Pressable
                  key={team.id}
                  onPress={() => setMatchTeamA(team.id)}
                  style={[styles.teamChip, matchTeamA === team.id && { backgroundColor: team.color, borderColor: team.color }]}
                >
                  <Text style={styles.teamChipEmoji}>{team.emoji}</Text>
                  <Text style={[styles.teamChipText, matchTeamA === team.id && styles.teamChipTextActive]}>{team.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.vsText}>VS</Text>
            <View style={styles.teamChipRow}>
              {tournament.teams
                .filter((t) => t.id !== matchTeamA)
                .map((team) => (
                  <Pressable
                    key={team.id}
                    onPress={() => setMatchTeamB(team.id)}
                    style={[styles.teamChip, matchTeamB === team.id && { backgroundColor: team.color, borderColor: team.color }]}
                  >
                    <Text style={styles.teamChipEmoji}>{team.emoji}</Text>
                    <Text style={[styles.teamChipText, matchTeamB === team.id && styles.teamChipTextActive]}>{team.name}</Text>
                  </Pressable>
                ))}
            </View>
            <Pressable
              style={[styles.modalSubmit, (addingMatch || matchTeamA == null || matchTeamB == null) && styles.modalSubmitDisabled]}
              onPress={handleAddMatch}
              disabled={addingMatch || matchTeamA == null || matchTeamB == null}
            >
              {addingMatch ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalSubmitText}>Schedule Match</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      <ShareToCommunityModal
        visible={showCommunityShare}
        onClose={() => setShowCommunityShare(false)}
        shareType="TOURNAMENT"
        referenceId={String(tournament.id)}
        label="Share Tournament"
      />
      <TeamSearchSheet
        visible={inviteSheetVisible}
        onClose={() => setInviteSheetVisible(false)}
        onSelect={handleInviteTeam}
        title="Invite a Team"
        excludeTeamIds={tournament.teams.filter((t) => t.status !== 'DECLINED').map((t) => t.appTeamId).filter((x): x is string => !!x)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1 },
  refreshableArea: { flex: 1, position: 'relative' },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroShadow: {
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 26,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
    alignItems: 'center',
    borderRadius: 26,
    overflow: 'hidden',
  },
  headerGlassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 44,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  heroMetaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  lifecycleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 10,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  lifecycleBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  teamsRow: {
    marginBottom: 24,
  },
  teamCard: {
    width: 110,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    gap: 4,
  },
  teamCardEmoji: {
    fontSize: 26,
  },
  teamCardName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  teamCardMeta: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  emptyHint: {
    fontSize: 12,
    color: colors.neutral400,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  matchCardTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-start',
  },
  matchCardEmoji: {
    fontSize: 18,
  },
  matchCardTeamName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  matchCardScoreWrap: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
  },
  matchCardScore: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  matchStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  matchStatusPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTeamEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 14,
    textAlign: 'center',
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 6,
  },
  rosterRowText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  modalInput: {
    width: '100%',
    backgroundColor: colors.neutral100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 14,
  },
  modalSubmit: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSubmitDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  teamChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    justifyContent: 'center',
  },
  teamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.neutral100,
    borderWidth: 1,
    borderColor: colors.neutral200,
  },
  teamChipEmoji: {
    fontSize: 14,
  },
  teamChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  teamChipTextActive: {
    color: colors.white,
  },
  errorWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: colors.background },
  errorTitle: { fontSize: 19, fontWeight: '900', color: colors.text, marginTop: 8, textAlign: 'center' },
  errorBody: { fontSize: 14, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  errorRetry: { marginTop: 20, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13 },
  errorRetryText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  errorBack: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  inviteBanner: {
    backgroundColor: colors.primary + '12', borderColor: colors.primary, borderWidth: 1.5,
    borderRadius: 16, padding: 14, marginBottom: 14,
  },
  inviteBannerTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  inviteBannerSub: { fontSize: 12.5, color: colors.textSecondary, marginTop: 3 },
  inviteBannerActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  inviteAccept: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  inviteAcceptText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  inviteDecline: { flex: 1, borderColor: colors.neutral300, borderWidth: 1.5, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  inviteDeclineText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  joinCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.cardBg,
    borderRadius: 16, padding: 14, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  joinCardTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  joinCardSub: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  joinBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, minWidth: 120, alignItems: 'center' },
  joinBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '800' },
  pendingWrap: { marginBottom: 10, gap: 6 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pendingName: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '600' },
  pendingCancel: { fontSize: 12.5, color: colors.error, fontWeight: '800' },
  teamCardRemove: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral100, zIndex: 2,
  },
  withdrawBtn: { borderWidth: 1.5, borderColor: colors.error, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  withdrawBtnText: { color: colors.error, fontSize: 13, fontWeight: '800' },
  pendingInvites: { fontSize: 12.5, color: colors.textSecondary, marginTop: -4, marginBottom: 8 },
  vsText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: colors.neutral400,
    marginBottom: 8,
  },
});
