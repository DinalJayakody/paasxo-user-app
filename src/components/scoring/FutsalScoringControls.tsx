import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Plus, Undo2 } from 'lucide-react-native';
import { ThemeColors } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { MatchScorecard, MatchScoreState, MatchTeamPlayer } from '../../types/api';
import { RecordEventPayload } from '../../api/matchScoreApi';
import { RosterPlayerSelectSheet } from './RosterPlayerSelectSheet';

interface FutsalScoringControlsProps {
  score: MatchScoreState;
  scorecard: MatchScorecard | null;
  displaySeconds: number;
  teamAName: string;
  teamBName: string;
  updating: boolean;
  onUpdateState: (payload: { teamAScore?: number; teamBScore?: number; state?: Record<string, any> }) => Promise<any>;
  onRecordEvent: (payload: RecordEventPayload) => Promise<any>;
  onUndoLastEvent: () => Promise<any>;
}

export function FutsalScoringControls({
  score,
  scorecard,
  displaySeconds,
  teamAName,
  teamBName,
  updating,
  onUpdateState,
  onRecordEvent,
  onUndoLastEvent,
}: FutsalScoringControlsProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [pickerTeam, setPickerTeam] = useState<'A' | 'B' | null>(null);
  const half: 1 | 2 = score.state?.half ?? 1;
  const goalEvents = (scorecard?.events ?? []).filter((e) => e.eventType === 'GOAL');

  const openScorerPicker = (team: 'A' | 'B') => {
    if (updating) return;
    setPickerTeam(team);
  };

  const logGoal = (team: 'A' | 'B', scorer: MatchTeamPlayer | null) => {
    const minute = Math.max(1, Math.round(displaySeconds / 60));
    onRecordEvent({ teamLabel: team, eventType: 'GOAL', playerId: scorer?.id ?? null, minute });
  };

  const setHalf = (h: 1 | 2) => {
    if (updating || h === half) return;
    onUpdateState({ state: { ...score.state, half: h } });
  };

  const rosterForPicker = pickerTeam === 'A' ? (scorecard?.teamA ?? []) : (scorecard?.teamB ?? []);

  return (
    <View style={styles.wrap}>
      <View style={styles.halfRow}>
        {[1, 2].map((h) => (
          <Pressable
            key={h}
            style={[styles.halfChip, half === h && styles.halfChipActive]}
            onPress={() => setHalf(h as 1 | 2)}
          >
            <Text style={[styles.halfChipText, half === h && styles.halfChipTextActive]}>
              {h === 1 ? '1st Half' : '2nd Half'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.goalRow}>
        <Pressable
          style={[styles.goalBtn, { backgroundColor: colors.futsal }]}
          onPress={() => openScorerPicker('A')}
          disabled={updating}
        >
          <Plus color={colors.white} size={20} strokeWidth={3} />
          <Text style={styles.goalBtnText} numberOfLines={1}>{teamAName}</Text>
          <Text style={styles.goalBtnSub}>GOAL</Text>
        </Pressable>
        <Pressable
          style={[styles.goalBtn, { backgroundColor: colors.primaryDark }]}
          onPress={() => openScorerPicker('B')}
          disabled={updating}
        >
          <Plus color={colors.white} size={20} strokeWidth={3} />
          <Text style={styles.goalBtnText} numberOfLines={1}>{teamBName}</Text>
          <Text style={styles.goalBtnSub}>GOAL</Text>
        </Pressable>
      </View>

      {goalEvents.length > 0 && (
        <View style={styles.eventsCard}>
          <View style={styles.eventsHeader}>
            <Text style={styles.eventsTitle}>Goal Log</Text>
            <Pressable onPress={onUndoLastEvent} disabled={updating} hitSlop={8} style={styles.undoBtn}>
              <Undo2 color={colors.neutral600} size={14} strokeWidth={2.2} />
              <Text style={styles.undoBtnText}>Undo last</Text>
            </Pressable>
          </View>
          {[...goalEvents].reverse().map((ev) => (
            <View key={ev.id} style={styles.eventRow}>
              <View style={[styles.eventDot, { backgroundColor: ev.teamLabel === 'A' ? colors.futsal : colors.primaryDark }]} />
              <Text style={styles.eventText}>
                {ev.minute}' — {ev.teamLabel === 'A' ? teamAName : teamBName}{ev.playerName ? ` (${ev.playerName})` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      <RosterPlayerSelectSheet
        visible={pickerTeam != null}
        onClose={() => setPickerTeam(null)}
        title={`Who scored for ${pickerTeam === 'A' ? teamAName : teamBName}?`}
        players={rosterForPicker}
        noneLabel="Unspecified scorer"
        onSelect={(player) => { if (pickerTeam) logGoal(pickerTeam, player); }}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { gap: 14 },
  halfRow: { flexDirection: 'row', gap: 8 },
  halfChip: {
    flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center',
    backgroundColor: colors.neutral100, borderWidth: 1.5, borderColor: 'transparent',
  },
  halfChipActive: { backgroundColor: colors.futsalLight, borderColor: colors.futsal },
  halfChipText: { fontSize: 12.5, fontWeight: '700', color: colors.neutral500 },
  halfChipTextActive: { color: colors.futsal },
  goalRow: { flexDirection: 'row', gap: 12 },
  goalBtn: {
    flex: 1, borderRadius: 18, paddingVertical: 18, alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  goalBtnText: { color: colors.white, fontSize: 14, fontWeight: '800', maxWidth: '90%' },
  goalBtnSub: { color: colors.white, fontSize: 10, fontWeight: '700', letterSpacing: 1, opacity: 0.85 },
  eventsCard: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 14, gap: 10 },
  eventsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventsTitle: { fontSize: 11, fontWeight: '800', color: colors.neutral500, letterSpacing: 1, textTransform: 'uppercase' },
  undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  undoBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.neutral600 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventDot: { width: 8, height: 8, borderRadius: 4 },
  eventText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
});
