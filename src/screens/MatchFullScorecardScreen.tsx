import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors, ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { useMatchScorecard } from '../hooks/useMatchScorecard';
import { MatchScoreEvent } from '../types/api';
import { LoadingScreen } from '../components/LoadingScreen';
import ScreenGlow from '../components/ScreenGlow';
import { goBack } from '../utils/navigation';

interface MatchFullScorecardScreenProps {
  matchId: string;
}

const SPORT_ACCENT: Record<string, string> = {
  FUTSAL: Colors.futsal,
  CRICKET: Colors.cricket,
  PICKLEBALL: Colors.pickleball,
  PADDLEBALL: Colors.paddleball,
};

function eventLine(e: MatchScoreEvent, teamAName: string, teamBName: string): string {
  const team = e.teamLabel === 'A' ? teamAName : teamBName;
  switch (e.eventType) {
    case 'GOAL': return `⚽ ${e.minute ?? '?'}' — ${e.playerName ?? 'Unattributed'} (${team})`;
    case 'ASSIST': return `🅰️ Assist — ${e.playerName ?? 'Unattributed'} (${team})`;
    case 'YELLOW_CARD': return `🟨 Yellow card — ${e.playerName ?? 'Unattributed'} (${team})`;
    case 'RED_CARD': return `🟥 Red card — ${e.playerName ?? 'Unattributed'} (${team})`;
    case 'SAVE': return `🧤 Save — ${e.playerName ?? 'Unattributed'} (${team})`;
    case 'POINT': return `• Point — ${e.playerName ? e.playerName + ' · ' : ''}${team}`;
    case 'BALL': {
      const over = `${e.overNumber ?? 0}.${e.ballInOver ?? 0}`;
      const extra = e.extraType ? ` ${e.extraType.replace('_', ' ').toLowerCase()}` : '';
      const wicket = e.isWicket ? ` WICKET${e.wicketType ? ` (${e.wicketType.replace('_', ' ').toLowerCase()})` : ''}` : '';
      return `${over} — ${e.playerName ?? 'Batsman'} ${e.runs ?? 0} run${(e.runs ?? 0) === 1 ? '' : 's'}${extra}${wicket} (b. ${e.bowlerName ?? '—'})`;
    }
    default: return e.eventType;
  }
}

export default function MatchFullScorecardScreen({ matchId }: MatchFullScorecardScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { scorecard, loading, error } = useMatchScorecard(matchId, true);

  if (loading) return <LoadingScreen message="Loading scorecard…" />;

  if (error && !scorecard) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.centerText}>{error}</Text>
      </SafeAreaView>
    );
  }
  if (!scorecard) return null;

  const accent = SPORT_ACCENT[scorecard.sport] || colors.primary;
  const isCricket = scorecard.sport === 'CRICKET';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable onPress={() => goBack(router)} style={styles.headerIconBtn} hitSlop={8}>
          <ArrowLeft color={colors.neutral900} size={20} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title}>Full Scorecard</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.scoreCard, { borderColor: accent + '55' }]}>
          <View style={styles.scoreRow}>
            <View style={styles.teamBlock}>
              <Text style={styles.teamName} numberOfLines={1}>{scorecard.teamAName}</Text>
              <Text style={[styles.scoreValue, { color: accent }]}>{scorecard.teamAScore}</Text>
            </View>
            <Text style={styles.vsText}>-</Text>
            <View style={styles.teamBlock}>
              <Text style={styles.teamName} numberOfLines={1}>{scorecard.teamBName}</Text>
              <Text style={[styles.scoreValue, { color: accent }]}>{scorecard.teamBScore}</Text>
            </View>
          </View>
        </View>

        {isCricket && scorecard.innings && scorecard.innings.map((inn) => {
          const battingTeamName = inn.battingTeamLabel === 'A' ? scorecard.teamAName : scorecard.teamBName;
          return (
            <View key={inn.inningsNumber} style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                Innings {inn.inningsNumber} — {battingTeamName} batting
              </Text>
              <Text style={styles.inningsTally}>
                {inn.runs}/{inn.wickets} <Text style={styles.inningsOvers}>({inn.overs}.{inn.ballsInOver} overs)</Text>
              </Text>

              <Text style={styles.tableHeader}>Batting</Text>
              <View style={styles.table}>
                {inn.batting.map((b) => (
                  <View key={b.playerId} style={styles.tableRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tableName} numberOfLines={1}>{b.playerName}</Text>
                      {b.out && !!b.howOut && <Text style={styles.howOut}>{b.howOut}</Text>}
                      {!b.out && <Text style={styles.notOut}>not out</Text>}
                    </View>
                    <Text style={styles.tableStat}>{b.runs}</Text>
                    <Text style={styles.tableStatMuted}>({b.ballsFaced})</Text>
                    <Text style={styles.tableStatMuted}>{b.fours}x4</Text>
                    <Text style={styles.tableStatMuted}>{b.sixes}x6</Text>
                  </View>
                ))}
                {inn.batting.length === 0 && <Text style={styles.emptyTableText}>No deliveries yet</Text>}
              </View>

              <Text style={styles.tableHeader}>Bowling</Text>
              <View style={styles.table}>
                {inn.bowling.map((b) => (
                  <View key={b.playerId} style={styles.tableRow}>
                    <Text style={[styles.tableName, { flex: 1 }]} numberOfLines={1}>{b.playerName}</Text>
                    <Text style={styles.tableStatMuted}>{b.completedOvers}.{b.ballsInCurrentOver} ov</Text>
                    <Text style={styles.tableStat}>{b.runsConceded}</Text>
                    <Text style={styles.tableStatMuted}>-{b.wickets}</Text>
                  </View>
                ))}
                {inn.bowling.length === 0 && <Text style={styles.emptyTableText}>No deliveries yet</Text>}
              </View>
            </View>
          );
        })}

        {!isCricket && scorecard.scorers && scorecard.scorers.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Scorers</Text>
            <View style={styles.table}>
              {scorecard.scorers.map((s) => (
                <View key={s.playerId} style={styles.tableRow}>
                  <Text style={[styles.tableName, { flex: 1 }]} numberOfLines={1}>
                    {s.playerName} <Text style={styles.tableTeamTag}>({s.teamLabel === 'A' ? scorecard.teamAName : scorecard.teamBName})</Text>
                  </Text>
                  {s.goals > 0 && <Text style={styles.tableStat}>⚽{s.goals}</Text>}
                  {s.points > 0 && <Text style={styles.tableStat}>•{s.points}</Text>}
                  {s.assists > 0 && <Text style={styles.tableStatMuted}>A:{s.assists}</Text>}
                  {s.yellowCards > 0 && <Text style={styles.tableStatMuted}>🟨{s.yellowCards}</Text>}
                  {s.redCards > 0 && <Text style={styles.tableStatMuted}>🟥{s.redCards}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Full Timeline</Text>
          {scorecard.events.length === 0 ? (
            <Text style={styles.emptyTableText}>No events recorded yet</Text>
          ) : (
            [...scorecard.events].reverse().map((e) => (
              <Text key={e.id} style={styles.timelineRow}>{eventLine(e, scorecard.teamAName, scorecard.teamBName)}</Text>
            ))
          )}
        </View>
      </ScrollView>
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

  scoreCard: { backgroundColor: colors.cardBg, borderRadius: 20, padding: 18, borderWidth: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  teamBlock: { flex: 1, alignItems: 'center', gap: 4, maxWidth: 140 },
  teamName: { fontSize: 12, fontWeight: '700', color: colors.neutral600, textTransform: 'uppercase', letterSpacing: 0.4 },
  scoreValue: { fontSize: 36, fontWeight: '900', fontVariant: ['tabular-nums'] },
  vsText: { fontSize: 18, fontWeight: '700', color: colors.neutral300 },

  sectionCard: { backgroundColor: colors.cardBg, borderRadius: 18, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.neutral900 },
  inningsTally: { fontSize: 22, fontWeight: '900', color: colors.text },
  inningsOvers: { fontSize: 13, fontWeight: '600', color: colors.textMuted },

  tableHeader: { fontSize: 10.5, fontWeight: '800', color: colors.neutral500, letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 },
  table: { gap: 6 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tableName: { fontSize: 13, fontWeight: '700', color: colors.text },
  tableTeamTag: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  tableStat: { fontSize: 13, fontWeight: '800', color: colors.text },
  tableStatMuted: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  howOut: { fontSize: 11, color: colors.textMuted },
  notOut: { fontSize: 11, color: colors.success, fontWeight: '700' },
  emptyTableText: { fontSize: 12.5, color: colors.textMuted, fontStyle: 'italic' },

  timelineRow: { fontSize: 12.5, color: colors.text, lineHeight: 20 },
});
