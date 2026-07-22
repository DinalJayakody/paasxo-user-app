import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  RefreshControl,
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
import { Colors } from '../styles/colors';
import { AuthContext } from '../context/AuthContext';
import { tournamentApi } from '../api/tournamentApi';
import { futsalApi } from '../api/futsalApi';
import { tournamentStorage } from '../utils/tournamentStorage';
import { buildTeamUI, buildMatchUI, buildTournamentUI } from '../utils/parseTournament';
import { TournamentUI, TournamentTeamUI } from '../types/api';

interface TournamentDetailsScreenProps {
  tournamentId: string;
}

export default function TournamentDetailsScreen({ tournamentId }: TournamentDetailsScreenProps) {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [tournament, setTournament] = useState<TournamentUI | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rosterTeam, setRosterTeam] = useState<TournamentTeamUI | null>(null);

  const [addTeamVisible, setAddTeamVisible] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);

  const [addMatchVisible, setAddMatchVisible] = useState(false);
  const [matchTeamA, setMatchTeamA] = useState<number | null>(null);
  const [matchTeamB, setMatchTeamB] = useState<number | null>(null);
  const [addingMatch, setAddingMatch] = useState(false);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [record, teamRecords, matchRecords] = await Promise.all([
        tournamentApi.getTournament(tournamentId),
        tournamentApi.listTeams(tournamentId),
        tournamentApi.listMatches(tournamentId),
      ]);

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
    } catch (err) {
      console.warn('Failed to load tournament', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournamentId, user]);

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

  const handleShare = () => {
    if (!tournament) return;
    Share.share({
      message: `Follow "${tournament.name}" live on Paasxo! Tournament #${tournament.id} at ${tournament.venueName || 'the venue'}.`,
    }).catch(() => {});
  };

  if (loading || !tournament) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const lifecycleConfig = {
    UPCOMING: { label: 'Upcoming', color: Colors.neutral500, bg: Colors.neutral200 },
    LIVE: { label: 'Live Now', color: '#DC2626', bg: '#FDE8E8' },
    COMPLETED: { label: 'Completed', color: Colors.success, bg: '#E7F8EE' },
  }[tournament.lifecycle];

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Pressable style={styles.circleBtn} onPress={() => router.back()}>
            <ArrowLeft color={Colors.white} size={20} strokeWidth={2.5} />
          </Pressable>
          <Pressable style={styles.circleBtn} onPress={handleShare}>
            <Share2 color={Colors.white} size={18} strokeWidth={2.5} />
          </Pressable>
        </View>
        <Text style={styles.heroEmoji}>🏆</Text>
        <Text style={styles.heroTitle}>{tournament.name}</Text>
        {tournament.venueName && (
          <View style={styles.heroMetaRow}>
            <MapPin color={Colors.white} size={13} strokeWidth={2.5} />
            <Text style={styles.heroMetaText}>{tournament.venueName}</Text>
          </View>
        )}
        <View style={styles.heroMetaRow}>
          <Calendar color={Colors.white} size={13} strokeWidth={2.5} />
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
      </LinearGradient>

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Teams ({tournament.teams.length})</Text>
          {tournament.isOwner && (
            <Pressable style={styles.addChip} onPress={() => setAddTeamVisible(true)}>
              <Plus color={Colors.primary} size={14} strokeWidth={2.5} />
              <Text style={[styles.addChipText, { color: Colors.primary }]}>Add Team</Text>
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamsRow}>
          {tournament.teams.map((team) => (
            <Pressable key={team.id} style={[styles.teamCard, { borderColor: team.color }]} onPress={() => setRosterTeam(team)}>
              <Text style={styles.teamCardEmoji}>{team.emoji}</Text>
              <Text style={styles.teamCardName}>{team.name}</Text>
              <Text style={styles.teamCardMeta}>{team.players.length} players</Text>
            </Pressable>
          ))}
          {tournament.teams.length === 0 && (
            <Text style={styles.emptyHint}>No teams added yet.</Text>
          )}
        </ScrollView>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Fixtures ({tournament.matches.length})</Text>
          {tournament.isOwner && (
            <Pressable style={styles.addChip} onPress={() => setAddMatchVisible(true)}>
              <Plus color={Colors.primary} size={14} strokeWidth={2.5} />
              <Text style={[styles.addChipText, { color: Colors.primary }]}>Schedule</Text>
            </Pressable>
          )}
        </View>

        {tournament.matches.length === 0 ? (
          <Text style={styles.emptyHint}>No matches scheduled yet.</Text>
        ) : (
          tournament.matches.map((match) => {
            const statusConfig = {
              SCHEDULED: { label: 'Scheduled', color: Colors.neutral500, bg: Colors.neutral200 },
              LIVE: { label: 'Live', color: '#DC2626', bg: '#FDE8E8' },
              COMPLETED: { label: 'Final', color: Colors.success, bg: '#E7F8EE' },
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
                    <Swords color={Colors.neutral400} size={18} strokeWidth={2} />
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

      {/* Roster modal */}
      <Modal visible={!!rosterTeam} transparent animationType="fade" onRequestClose={() => setRosterTeam(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.modalClose} onPress={() => setRosterTeam(null)}>
              <X color={Colors.text} size={18} strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.modalTeamEmoji}>{rosterTeam?.emoji}</Text>
            <Text style={styles.modalTitle}>{rosterTeam?.name}</Text>
            {rosterTeam?.players.length ? (
              rosterTeam.players.map((p) => (
                <View key={p.id} style={styles.rosterRow}>
                  <Crown color={Colors.primary} size={14} strokeWidth={2} />
                  <Text style={styles.rosterRowText}>{p.playerDisplayName || p.playerFirebaseUid}</Text>
                </View>
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
              <X color={Colors.text} size={18} strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.modalTitle}>Add a team</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Team name"
              placeholderTextColor={Colors.neutral400}
              value={newTeamName}
              onChangeText={setNewTeamName}
            />
            <Pressable
              style={[styles.modalSubmit, addingTeam && styles.modalSubmitDisabled]}
              onPress={handleAddTeam}
              disabled={addingTeam}
            >
              {addingTeam ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalSubmitText}>Add Team</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add match modal */}
      <Modal visible={addMatchVisible} transparent animationType="fade" onRequestClose={() => setAddMatchVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable style={styles.modalClose} onPress={() => setAddMatchVisible(false)}>
              <X color={Colors.text} size={18} strokeWidth={2.5} />
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
              {addingMatch ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalSubmitText}>Schedule Match</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  loadingScreen: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
    alignItems: 'center',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    color: Colors.white,
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
    color: Colors.text,
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
    color: Colors.primary,
  },
  teamsRow: {
    marginBottom: 24,
  },
  teamCard: {
    width: 110,
    backgroundColor: Colors.white,
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
    color: Colors.text,
    textAlign: 'center',
  },
  teamCardMeta: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  emptyHint: {
    fontSize: 12,
    color: Colors.neutral400,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
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
    color: Colors.text,
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
    color: Colors.text,
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
    backgroundColor: Colors.white,
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
    backgroundColor: Colors.neutral100,
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
    color: Colors.text,
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
    color: Colors.text,
    fontWeight: '600',
  },
  modalInput: {
    width: '100%',
    backgroundColor: Colors.neutral100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 14,
  },
  modalSubmit: {
    width: '100%',
    backgroundColor: Colors.primary,
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
    color: Colors.white,
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
    backgroundColor: Colors.neutral100,
    borderWidth: 1,
    borderColor: Colors.neutral200,
  },
  teamChipEmoji: {
    fontSize: 14,
  },
  teamChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  teamChipTextActive: {
    color: Colors.white,
  },
  vsText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: Colors.neutral400,
    marginBottom: 8,
  },
});
