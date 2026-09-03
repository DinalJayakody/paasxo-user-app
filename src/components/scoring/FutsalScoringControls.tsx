import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { ThemeColors } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { MatchScoreState } from '../../types/api';
import { formatMatchDuration } from '../../utils/matchTimer';

interface GoalEvent {
  team: 'A' | 'B';
  minute: number;
  scorer?: string;
}

interface FutsalScoringControlsProps {
  score: MatchScoreState;
  displaySeconds: number;
  teamAName: string;
  teamBName: string;
  updating: boolean;
  onUpdateState: (payload: { teamAScore?: number; teamBScore?: number; state?: Record<string, any> }) => Promise<any>;
}

export function FutsalScoringControls({
  score,
  displaySeconds,
  teamAName,
  teamBName,
  updating,
  onUpdateState,
}: FutsalScoringControlsProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [scorerName, setScorerName] = useState('');
  const half: 1 | 2 = score.state?.half ?? 1;
  const events: GoalEvent[] = Array.isArray(score.state?.events) ? score.state.events : [];

  const logGoal = (team: 'A' | 'B') => {
    if (updating) return;
    const minute = Math.max(1, Math.round(displaySeconds / 60));
    const nextEvents = [...events, { team, minute, scorer: scorerName.trim() || undefined }];
    onUpdateState({
      teamAScore: team === 'A' ? score.teamAScore + 1 : score.teamAScore,
      teamBScore: team === 'B' ? score.teamBScore + 1 : score.teamBScore,
      state: { ...score.state, half, events: nextEvents },
    });
    setScorerName('');
  };

  const removeEvent = (index: number) => {
    if (updating) return;
    const removed = events[index];
    const nextEvents = events.filter((_, i) => i !== index);
    onUpdateState({
      teamAScore: removed.team === 'A' ? Math.max(0, score.teamAScore - 1) : score.teamAScore,
      teamBScore: removed.team === 'B' ? Math.max(0, score.teamBScore - 1) : score.teamBScore,
      state: { ...score.state, half, events: nextEvents },
    });
  };

  const setHalf = (h: 1 | 2) => {
    if (updating || h === half) return;
    onUpdateState({ state: { ...score.state, half: h, events } });
  };

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

      <TextInput
        style={styles.scorerInput}
        placeholder="Scorer name (optional)"
        placeholderTextColor={colors.textMuted}
        value={scorerName}
        onChangeText={setScorerName}
      />

      <View style={styles.goalRow}>
        <Pressable
          style={[styles.goalBtn, { backgroundColor: colors.futsal }]}
          onPress={() => logGoal('A')}
          disabled={updating}
        >
          <Plus color={colors.white} size={20} strokeWidth={3} />
          <Text style={styles.goalBtnText} numberOfLines={1}>{teamAName}</Text>
          <Text style={styles.goalBtnSub}>GOAL</Text>
        </Pressable>
        <Pressable
          style={[styles.goalBtn, { backgroundColor: colors.primaryDark }]}
          onPress={() => logGoal('B')}
          disabled={updating}
        >
          <Plus color={colors.white} size={20} strokeWidth={3} />
          <Text style={styles.goalBtnText} numberOfLines={1}>{teamBName}</Text>
          <Text style={styles.goalBtnSub}>GOAL</Text>
        </Pressable>
      </View>

      {events.length > 0 && (
        <View style={styles.eventsCard}>
          <Text style={styles.eventsTitle}>Goal Log</Text>
          {[...events].reverse().map((ev, i) => {
            const realIndex = events.length - 1 - i;
            return (
              <View key={realIndex} style={styles.eventRow}>
                <View style={[styles.eventDot, { backgroundColor: ev.team === 'A' ? colors.futsal : colors.primaryDark }]} />
                <Text style={styles.eventText}>
                  {ev.minute}' — {ev.team === 'A' ? teamAName : teamBName}{ev.scorer ? ` (${ev.scorer})` : ''}
                </Text>
                <Pressable onPress={() => removeEvent(realIndex)} disabled={updating} hitSlop={8}>
                  <X color={colors.neutral400} size={15} strokeWidth={2.5} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
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
  scorerInput: {
    backgroundColor: colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 13.5, color: colors.text,
  },
  goalRow: { flexDirection: 'row', gap: 12 },
  goalBtn: {
    flex: 1, borderRadius: 18, paddingVertical: 18, alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  goalBtnText: { color: colors.white, fontSize: 14, fontWeight: '800', maxWidth: '90%' },
  goalBtnSub: { color: colors.white, fontSize: 10, fontWeight: '700', letterSpacing: 1, opacity: 0.85 },
  eventsCard: { backgroundColor: colors.cardBg, borderRadius: 16, padding: 14, gap: 10 },
  eventsTitle: { fontSize: 11, fontWeight: '800', color: colors.neutral500, letterSpacing: 1, textTransform: 'uppercase' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventDot: { width: 8, height: 8, borderRadius: 4 },
  eventText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
});
