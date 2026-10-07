import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, Pencil, Shuffle, UserPlus, X } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { matchTeamApi } from '../api/matchTeamApi';
import { MatchTeamPlayer, MatchTeams } from '../types/api';
import { extractApiError } from '../utils/apiError';
import { AddTeamPlayerSheet } from '../components/scoring/AddTeamPlayerSheet';
import { LoadingScreen } from '../components/LoadingScreen';
import ScreenGlow from '../components/ScreenGlow';
import { goBack } from '../utils/navigation';

interface MatchTeamsScreenProps {
  matchId: string;
}

function TeamCard({
  label,
  teamName,
  players,
  accent,
  colors,
  styles,
  onRename,
  onAddPress,
  onRemove,
  removingId,
  canManage,
}: {
  label: 'A' | 'B';
  teamName: string;
  players: MatchTeamPlayer[];
  accent: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onRename: (name: string) => void;
  onAddPress: () => void;
  onRemove: (playerId: number) => void;
  removingId: number | null;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(teamName);

  useEffect(() => { setDraftName(teamName); }, [teamName]);

  return (
    <View style={styles.teamCard}>
      <View style={[styles.teamHeader, { borderColor: accent }]}>
        {editing ? (
          <>
            <TextInput
              style={[styles.teamNameInput, { color: accent }]}
              value={draftName}
              onChangeText={setDraftName}
              autoFocus
              maxLength={40}
            />
            <Pressable
              onPress={() => { setEditing(false); if (draftName.trim() && draftName.trim() !== teamName) onRename(draftName.trim()); }}
              hitSlop={8}
            >
              <Check color={accent} size={18} strokeWidth={2.4} />
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.teamName, { color: accent }]} numberOfLines={1}>{teamName}</Text>
            {canManage && (
              <Pressable onPress={() => setEditing(true)} hitSlop={8}>
                <Pencil color={colors.textMuted} size={15} strokeWidth={2.2} />
              </Pressable>
            )}
          </>
        )}
      </View>

      {players.length === 0 ? (
        <Text style={styles.emptyRosterText}>No players yet</Text>
      ) : (
        players.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{(p.displayName[0] ?? '?').toUpperCase()}</Text>
            </View>
            <Text style={styles.playerName} numberOfLines={1}>{p.displayName}</Text>
            {!p.playerFirebaseUid && <Text style={styles.customTag}>Custom</Text>}
            {canManage && (
              <Pressable
                onPress={() => p.id != null && onRemove(p.id)}
                disabled={removingId === p.id}
                hitSlop={8}
                style={styles.removeBtn}
              >
                {removingId === p.id ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <X color={colors.error} size={14} strokeWidth={2.4} />
                )}
              </Pressable>
            )}
          </View>
        ))
      )}

      {canManage && (
        <Pressable style={[styles.addPlayerBtn, { borderColor: accent }]} onPress={onAddPress}>
          <UserPlus color={accent} size={15} strokeWidth={2.4} />
          <Text style={[styles.addPlayerBtnText, { color: accent }]}>Add Player</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function MatchTeamsScreen({ matchId }: MatchTeamsScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [teams, setTeams] = useState<MatchTeams | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [addSheetTeam, setAddSheetTeam] = useState<'A' | 'B' | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [addingUnassignedUid, setAddingUnassignedUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await matchTeamApi.getTeams(matchId);
      setTeams(data);
      setError(undefined);
    } catch (err) {
      setError(extractApiError(err, 'Could not load teams'));
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { load(); }, [load]);

  const handleRename = async (team: 'A' | 'B', name: string) => {
    try {
      const next = await matchTeamApi.renameTeam(matchId, team, name);
      setTeams(next);
    } catch (err) {
      Alert.alert('Could Not Rename', extractApiError(err, 'Please try again.'));
    }
  };

  const handleRemove = async (playerId: number) => {
    setRemovingId(playerId);
    try {
      await matchTeamApi.removePlayer(matchId, playerId);
      await load();
    } catch (err) {
      Alert.alert('Could Not Remove', extractApiError(err, 'Please try again.'));
    } finally {
      setRemovingId(null);
    }
  };

  const handleAutoSplit = () => {
    Alert.alert(
      'Auto-Split Joined Players?',
      'This replaces the current roster, evenly dividing everyone who joined this match between Team A and Team B. You can still hand-edit afterward.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Split Teams',
          onPress: async () => {
            setSplitting(true);
            try {
              const next = await matchTeamApi.autoSplit(matchId);
              setTeams(next);
            } catch (err) {
              Alert.alert('Could Not Split Teams', extractApiError(err, 'Please try again.'));
            } finally {
              setSplitting(false);
            }
          },
        },
      ]
    );
  };

  const handleAddUnassigned = async (team: 'A' | 'B', player: MatchTeamPlayer) => {
    if (!player.playerFirebaseUid) return;
    setAddingUnassignedUid(player.playerFirebaseUid);
    try {
      await matchTeamApi.addPlayer(matchId, team, { playerFirebaseUid: player.playerFirebaseUid });
      await load();
    } catch (err) {
      Alert.alert('Could Not Add Player', extractApiError(err, 'Please try again.'));
    } finally {
      setAddingUnassignedUid(null);
    }
  };

  if (loading) return <LoadingScreen message="Loading teams…" />;

  if (error && !teams) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.centerText}>{error}</Text>
      </SafeAreaView>
    );
  }
  if (!teams) return null;

  const rosteredUids = [...teams.teamA, ...teams.teamB]
    .map((p) => p.playerFirebaseUid).filter((u): u is string => !!u);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable onPress={() => goBack(router)} style={styles.headerIconBtn} hitSlop={8}>
          <ArrowLeft color={colors.neutral900} size={20} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title}>Manage Teams</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!teams.canManage && (
          <Text style={styles.readOnlyNotice}>Only the match organizer can edit teams — you're viewing read-only.</Text>
        )}

        {teams.canManage && (
          <Pressable style={styles.autoSplitBtn} onPress={handleAutoSplit} disabled={splitting}>
            {splitting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Shuffle color={colors.primary} size={15} strokeWidth={2.4} />
                <Text style={styles.autoSplitBtnText}>Auto-Split All Joined Players</Text>
              </>
            )}
          </Pressable>
        )}

        <TeamCard
          label="A" teamName={teams.teamAName} players={teams.teamA} accent={colors.futsal}
          colors={colors} styles={styles}
          onRename={(name) => handleRename('A', name)}
          onAddPress={() => setAddSheetTeam('A')}
          onRemove={handleRemove}
          removingId={removingId}
          canManage={teams.canManage}
        />
        <TeamCard
          label="B" teamName={teams.teamBName} players={teams.teamB} accent={colors.primaryDark}
          colors={colors} styles={styles}
          onRename={(name) => handleRename('B', name)}
          onAddPress={() => setAddSheetTeam('B')}
          onRemove={handleRemove}
          removingId={removingId}
          canManage={teams.canManage}
        />

        {teams.canManage && teams.unassignedJoinedPlayers.length > 0 && (
          <View style={styles.unassignedCard}>
            <Text style={styles.unassignedTitle}>Joined but not yet on a team</Text>
            {teams.unassignedJoinedPlayers.map((p) => (
              <View key={p.playerFirebaseUid} style={styles.unassignedRow}>
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{(p.displayName[0] ?? '?').toUpperCase()}</Text>
                </View>
                <Text style={styles.playerName} numberOfLines={1}>{p.displayName}</Text>
                {addingUnassignedUid === p.playerFirebaseUid ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={styles.quickAddRow}>
                    <Pressable style={[styles.quickAddBtn, { backgroundColor: colors.futsal }]} onPress={() => handleAddUnassigned('A', p)}>
                      <Text style={styles.quickAddBtnText}>→ A</Text>
                    </Pressable>
                    <Pressable style={[styles.quickAddBtn, { backgroundColor: colors.primaryDark }]} onPress={() => handleAddUnassigned('B', p)}>
                      <Text style={styles.quickAddBtnText}>→ B</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <AddTeamPlayerSheet
        visible={addSheetTeam != null}
        onClose={() => setAddSheetTeam(null)}
        teamName={addSheetTeam === 'A' ? teams.teamAName : teams.teamBName}
        excludeUids={rosteredUids}
        onAddRegistered={async (player) => {
          await matchTeamApi.addPlayer(matchId, addSheetTeam!, { playerFirebaseUid: player.firebaseUid });
          await load();
        }}
        onAddCustom={async (displayName) => {
          await matchTeamApi.addPlayer(matchId, addSheetTeam!, { displayName });
          await load();
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  centerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerText: { fontSize: 13.5, color: colors.textSecondary, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.neutral200 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.neutral900 },

  scroll: { paddingHorizontal: 18, paddingBottom: 48, gap: 16 },
  readOnlyNotice: { fontSize: 12.5, color: colors.textMuted, fontStyle: 'italic' },

  autoSplitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primaryLight, borderRadius: 14, paddingVertical: 12,
  },
  autoSplitBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  teamCard: { backgroundColor: colors.cardBg, borderRadius: 18, padding: 16, gap: 10 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 2, paddingBottom: 10, gap: 10 },
  teamName: { flex: 1, fontSize: 16, fontWeight: '900' },
  teamNameInput: { flex: 1, fontSize: 16, fontWeight: '900', padding: 0 },
  emptyRosterText: { fontSize: 12.5, color: colors.textMuted, fontStyle: 'italic', paddingVertical: 4 },

  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 13, fontWeight: '700', color: colors.primary },
  playerName: { flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.text },
  customTag: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  removeBtn: { padding: 4 },

  addPlayerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 12, paddingVertical: 10, marginTop: 4,
  },
  addPlayerBtnText: { fontSize: 12.5, fontWeight: '700' },

  unassignedCard: { backgroundColor: colors.cardBg, borderRadius: 18, padding: 16, gap: 10 },
  unassignedTitle: { fontSize: 11, fontWeight: '800', color: colors.neutral500, letterSpacing: 0.6, textTransform: 'uppercase' },
  unassignedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickAddRow: { flexDirection: 'row', gap: 6 },
  quickAddBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  quickAddBtnText: { color: colors.white, fontSize: 11.5, fontWeight: '800' },
});
