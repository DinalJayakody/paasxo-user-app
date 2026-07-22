import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Colors } from '../../styles/colors';
import { MatchScoreState } from '../../types/api';

interface RacketScoringControlsProps {
  score: MatchScoreState;
  teamAName: string;
  teamBName: string;
  accent: string;
  updating: boolean;
  onUpdateState: (payload: { teamAScore?: number; teamBScore?: number; state?: Record<string, any> }) => Promise<any>;
}

const DEFAULT_POINTS_TO_WIN = 11;

/** True once a team has reached the win target with at least a 2-point lead. */
function isGameOver(pointsA: number, pointsB: number, target: number): 'A' | 'B' | null {
  if (pointsA >= target && pointsA - pointsB >= 2) return 'A';
  if (pointsB >= target && pointsB - pointsA >= 2) return 'B';
  return null;
}

export function RacketScoringControls({ score, teamAName, teamBName, accent, updating, onUpdateState }: RacketScoringControlsProps) {
  const setsA: number = score.state?.setsA ?? 0;
  const setsB: number = score.state?.setsB ?? 0;
  const pointsToWin: number = score.state?.pointsToWin ?? DEFAULT_POINTS_TO_WIN;
  const gameHistory: { pointsA: number; pointsB: number }[] = Array.isArray(score.state?.gameHistory) ? score.state.gameHistory : [];

  const addPoint = (team: 'A' | 'B') => {
    if (updating) return;
    let pointsA = team === 'A' ? score.teamAScore + 1 : score.teamAScore;
    let pointsB = team === 'B' ? score.teamBScore + 1 : score.teamBScore;
    let nextSetsA = setsA;
    let nextSetsB = setsB;
    let nextHistory = gameHistory;

    const winner = isGameOver(pointsA, pointsB, pointsToWin);
    if (winner) {
      nextHistory = [...gameHistory, { pointsA, pointsB }];
      if (winner === 'A') nextSetsA += 1; else nextSetsB += 1;
      pointsA = 0;
      pointsB = 0;
    }

    onUpdateState({
      teamAScore: pointsA,
      teamBScore: pointsB,
      state: { ...score.state, setsA: nextSetsA, setsB: nextSetsB, pointsToWin, gameHistory: nextHistory },
    });
  };

  const adjustPoint = (team: 'A' | 'B', delta: -1) => {
    if (updating) return;
    const pointsA = team === 'A' ? Math.max(0, score.teamAScore + delta) : score.teamAScore;
    const pointsB = team === 'B' ? Math.max(0, score.teamBScore + delta) : score.teamBScore;
    onUpdateState({ teamAScore: pointsA, teamBScore: pointsB });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.setsRow}>
        <View style={styles.setsBadge}>
          <Text style={styles.setsLabel}>{teamAName}</Text>
          <Text style={[styles.setsValue, { color: accent }]}>{setsA}</Text>
        </View>
        <Text style={styles.setsVs}>SETS</Text>
        <View style={styles.setsBadge}>
          <Text style={styles.setsLabel}>{teamBName}</Text>
          <Text style={[styles.setsValue, { color: accent }]}>{setsB}</Text>
        </View>
      </View>
      <Text style={styles.raceLabel}>Race to {pointsToWin} · win by 2</Text>

      <View style={styles.pointsRow}>
        {(['A', 'B'] as const).map((team) => (
          <View key={team} style={styles.teamColumn}>
            <Text style={styles.teamName} numberOfLines={1}>{team === 'A' ? teamAName : teamBName}</Text>
            <Text style={[styles.pointsValue, { color: accent }]}>{team === 'A' ? score.teamAScore : score.teamBScore}</Text>
            <View style={styles.pointBtnRow}>
              <Pressable
                style={styles.minusBtn}
                onPress={() => adjustPoint(team, -1)}
                disabled={updating}
              >
                <Minus color={Colors.neutral600} size={16} strokeWidth={2.5} />
              </Pressable>
              <Pressable
                style={[styles.plusBtn, { backgroundColor: accent }]}
                onPress={() => addPoint(team)}
                disabled={updating}
              >
                <Plus color={Colors.white} size={22} strokeWidth={3} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      {gameHistory.length > 0 && (
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Completed Games</Text>
          <View style={styles.historyRow}>
            {gameHistory.map((g, i) => (
              <View key={i} style={styles.historyChip}>
                <Text style={styles.historyChipText}>{g.pointsA}-{g.pointsB}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  setsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  setsBadge: { alignItems: 'center', gap: 2 },
  setsLabel: { fontSize: 11, fontWeight: '700', color: Colors.neutral500, maxWidth: 100 },
  setsValue: { fontSize: 22, fontWeight: '900' },
  setsVs: { fontSize: 10, fontWeight: '800', color: Colors.neutral300, letterSpacing: 1 },
  raceLabel: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: Colors.textSecondary },

  pointsRow: { flexDirection: 'row', gap: 14 },
  teamColumn: { flex: 1, alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 18, paddingVertical: 16 },
  teamName: { fontSize: 12, fontWeight: '700', color: Colors.neutral600, maxWidth: '90%' },
  pointsValue: { fontSize: 36, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pointBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  minusBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
  },
  plusBtn: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },

  historyCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, gap: 8 },
  historyTitle: { fontSize: 11, fontWeight: '800', color: Colors.neutral500, letterSpacing: 1, textTransform: 'uppercase' },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyChip: { backgroundColor: Colors.neutral100, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  historyChipText: { fontSize: 12.5, fontWeight: '700', color: Colors.neutral700 },
});
