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
import { openProfile } from '../utils/openProfile';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
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
  // Scorecard rows reference roster entries by id; real app users on the rosters
  // carry a uid, so their names open their profile (typed-in names don't).
  const uidByPlayerId = new Map<number, string>();
  [...(scorecard.teamA ?? []), ...(scorecard.teamB ?? [])].forEach((p) => {
    if (p.id != null && p.playerFirebaseUid) uidByPlayerId.set(p.id, p.playerFirebaseUid);
  });
  const profileLink = (playerId: number) => {
    const uid = uidByPlayerId.get(playerId);
    return uid
      ? { onPress: () => openProfile(router, uid, user?.firebaseUid), suppressHighlighting: true, accessibilityRole: 'link' as const }
      : {};
  };

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
          const balls = inn.overs * 6 + inn.ballsInOver;
          const runRate = balls > 0 ? (inn.runs / (balls / 6)).toFixed(2) : '0.00';
          const extras = (inn.extrasWides ?? 0) + (inn.extrasNoBalls ?? 0) + (inn.extrasByes ?? 0) + (inn.extrasLegByes ?? 0);
          return (
            <View key={inn.inningsNumber} style={styles.sectionCard}>
              <View style={styles.inningsHead}>
                <Text style={styles.sectionTitle}>Innings {inn.inningsNumber} · {battingTeamName}</Text>
                <Text style={styles.inningsTally}>
                  {inn.runs}/{inn.wickets} <Text style={styles.inningsOvers}>({inn.overs}.{inn.ballsInOver} ov · RR {runRate})</Text>
                </Text>
              </View>

              {inn.ballByBall === false ? (
                <Text style={styles.emptyTableText}>
                  This innings was scored with totals only, so there's no batting or bowling breakdown. Choose the batter and bowler when scoring to get a full card.
                </Text>
              ) : (
                <>
              {/* Batting card */}
              <View style={[styles.gridRow, styles.gridHeadRow]}>
                <Text style={[styles.gridHead, styles.colName]}>Batter</Text>
                <Text style={styles.gridHead}>R</Text>
                <Text style={styles.gridHead}>B</Text>
                <Text style={styles.gridHead}>4s</Text>
                <Text style={styles.gridHead}>6s</Text>
                <Text style={[styles.gridHead, styles.colWide]}>SR</Text>
              </View>
              {inn.batting.map((b) => (
                <View key={b.playerId} style={styles.gridRow}>
                  <View style={styles.colName}>
                    <Text style={styles.tableName} numberOfLines={1} {...profileLink(b.playerId)}>{b.playerName}</Text>
                    {b.out && !!b.howOut ? <Text style={styles.howOut} numberOfLines={1}>{b.howOut}</Text> : !b.out ? <Text style={styles.notOut}>not out</Text> : null}
                  </View>
                  <Text style={styles.gridStrong}>{b.runs}</Text>
                  <Text style={styles.gridCell}>{b.ballsFaced}</Text>
                  <Text style={styles.gridCell}>{b.fours}</Text>
                  <Text style={styles.gridCell}>{b.sixes}</Text>
                  <Text style={[styles.gridCell, styles.colWide]}>{b.ballsFaced > 0 ? ((b.runs / b.ballsFaced) * 100).toFixed(1) : '—'}</Text>
                </View>
              ))}
              {inn.batting.length === 0 && <Text style={styles.emptyTableText}>No deliveries yet</Text>}

              <View style={styles.extrasRow}>
                <Text style={styles.extrasLabel}>Extras</Text>
                <Text style={styles.extrasValue}>
                  {extras}{' '}
                  <Text style={styles.extrasBreak}>(wd {inn.extrasWides ?? 0}, nb {inn.extrasNoBalls ?? 0}, b {inn.extrasByes ?? 0}, lb {inn.extrasLegByes ?? 0})</Text>
                </Text>
              </View>
              <View style={styles.extrasRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{inn.runs}/{inn.wickets} <Text style={styles.extrasBreak}>({inn.overs}.{inn.ballsInOver} overs)</Text></Text>
              </View>
              {!!inn.fallOfWickets?.length && (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.tableHeader}>Fall of wickets</Text>
                  <Text style={styles.fowText}>{inn.fallOfWickets.join(' · ')}</Text>
                </View>
              )}

              {/* Bowling card */}
              <View style={[styles.gridRow, styles.gridHeadRow, { marginTop: 10 }]}>
                <Text style={[styles.gridHead, styles.colName]}>Bowler</Text>
                <Text style={[styles.gridHead, styles.colWide]}>O</Text>
                <Text style={styles.gridHead}>R</Text>
                <Text style={styles.gridHead}>W</Text>
                <Text style={[styles.gridHead, styles.colWide]}>Econ</Text>
              </View>
              {inn.bowling.map((b) => {
                const bBalls = b.completedOvers * 6 + b.ballsInCurrentOver;
                return (
                  <View key={b.playerId} style={styles.gridRow}>
                    <Text style={[styles.tableName, styles.colName]} numberOfLines={1} {...profileLink(b.playerId)}>{b.playerName}</Text>
                    <Text style={[styles.gridCell, styles.colWide]}>{b.completedOvers}.{b.ballsInCurrentOver}</Text>
                    <Text style={styles.gridCell}>{b.runsConceded}</Text>
                    <Text style={styles.gridStrong}>{b.wickets}</Text>
                    <Text style={[styles.gridCell, styles.colWide]}>{bBalls > 0 ? (b.runsConceded / (bBalls / 6)).toFixed(2) : '—'}</Text>
                  </View>
                );
              })}
              {inn.bowling.length === 0 && <Text style={styles.emptyTableText}>No deliveries yet</Text>}
                </>
              )}
            </View>
          );
        })}

        {!isCricket && (() => {
          // Team-by-team totals from the per-player tallies.
          const tally = (label: 'A' | 'B') => (scorecard.scorers ?? []).filter((s) => s.teamLabel === label).reduce(
            (acc, s) => ({
              goals: acc.goals + s.goals + s.points, assists: acc.assists + s.assists,
              yellow: acc.yellow + s.yellowCards, red: acc.red + s.redCards, saves: acc.saves + s.saves,
            }),
            { goals: 0, assists: 0, yellow: 0, red: 0, saves: 0 },
          );
          const a = tally('A');
          const b = tally('B');
          const rows: [string, number, number][] = [
            [scorecard.sport === 'FUTSAL' ? 'Goals (attributed)' : 'Points (attributed)', a.goals, b.goals],
            ['Assists', a.assists, b.assists],
            ['Saves', a.saves, b.saves],
            ['Yellow cards', a.yellow, b.yellow],
            ['Red cards', a.red, b.red],
          ];
          return (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Team stats</Text>
              <View style={[styles.gridRow, styles.gridHeadRow]}>
                <Text style={[styles.gridHead, styles.colTeamStat]} numberOfLines={1}>{scorecard.teamAName}</Text>
                <Text style={[styles.gridHead, styles.colStatLabel]} />
                <Text style={[styles.gridHead, styles.colTeamStat]} numberOfLines={1}>{scorecard.teamBName}</Text>
              </View>
              {rows.map(([label, va, vb]) => (
                <View key={label} style={styles.gridRow}>
                  <Text style={[styles.gridStrong, styles.colTeamStat, va > vb && { color: accent }]}>{va}</Text>
                  <Text style={[styles.gridCell, styles.colStatLabel]}>{label}</Text>
                  <Text style={[styles.gridStrong, styles.colTeamStat, vb > va && { color: accent }]}>{vb}</Text>
                </View>
              ))}
            </View>
          );
        })()}

        {!isCricket && scorecard.scorers && scorecard.scorers.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Player contributions</Text>
            <View style={styles.table}>
              {scorecard.scorers.map((s) => (
                <View key={s.playerId} style={styles.tableRow}>
                  <Text style={[styles.tableName, { flex: 1 }]} numberOfLines={1} {...profileLink(s.playerId)}>
                    {s.playerName} <Text style={styles.tableTeamTag}>({s.teamLabel === 'A' ? scorecard.teamAName : scorecard.teamBName})</Text>
                  </Text>
                  {s.goals > 0 && <Text style={styles.tableStat}>⚽{s.goals}</Text>}
                  {s.points > 0 && <Text style={styles.tableStat}>•{s.points}</Text>}
                  {s.assists > 0 && <Text style={styles.tableStatMuted}>A:{s.assists}</Text>}
                  {s.saves > 0 && <Text style={styles.tableStatMuted}>🧤{s.saves}</Text>}
                  {s.yellowCards > 0 && <Text style={styles.tableStatMuted}>🟨{s.yellowCards}</Text>}
                  {s.redCards > 0 && <Text style={styles.tableStatMuted}>🟥{s.redCards}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Line-ups */}
        {((scorecard.teamA?.length ?? 0) > 0 || (scorecard.teamB?.length ?? 0) > 0) && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Line-ups</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {([['A', scorecard.teamAName, scorecard.teamA], ['B', scorecard.teamBName, scorecard.teamB]] as const).map(([k, name, list]) => (
                <View key={k} style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.tableHeader} numberOfLines={1}>{name}</Text>
                  {(list ?? []).map((p) => (
                    <Text key={p.id ?? p.displayName} style={styles.lineupName} numberOfLines={1} {...(p.id != null ? profileLink(p.id) : {})}>{p.displayName || 'Player'}</Text>
                  ))}
                  {(list ?? []).length === 0 && <Text style={styles.emptyTableText}>No line-up</Text>}
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

  inningsHead: { gap: 2, marginBottom: 4 },
  gridRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  gridHeadRow: { paddingVertical: 4 },
  gridHead: { width: 34, textAlign: 'right', fontSize: 10.5, fontWeight: '800', color: colors.neutral500, letterSpacing: 0.4 },
  gridCell: { width: 34, textAlign: 'right', fontSize: 12.5, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  gridStrong: { width: 34, textAlign: 'right', fontSize: 13, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'] },
  colName: { flex: 1, textAlign: 'left', paddingRight: 6 },
  colWide: { width: 46 },
  colTeamStat: { flex: 1, textAlign: 'center', width: undefined },
  colStatLabel: { flex: 1.4, textAlign: 'center', width: undefined },
  extrasRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  extrasLabel: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },
  extrasValue: { fontSize: 13, fontWeight: '800', color: colors.text },
  extrasBreak: { fontSize: 11.5, fontWeight: '600', color: colors.textMuted },
  totalLabel: { fontSize: 13.5, fontWeight: '900', color: colors.text },
  totalValue: { fontSize: 14, fontWeight: '900', color: colors.text },
  fowText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  lineupName: { fontSize: 12.5, color: colors.text, fontWeight: '600' },
});
