import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Award, ChevronRight, Clock, Footprints, MapPin, TrendingUp } from 'lucide-react-native';
import { ThemeColors } from '../../styles/colors';
import { ActivitySummary, ActivityPeriodProgress, ActivityPersonalBests, ActivityType } from '../../api/activityApi';
import { useActivityLocationGate } from './ActivityLocationGate';
import { formatDist, distUnit, formatPace, formatTime as formatDuration } from '../../utils/activityMath';

const ACT_META: Record<ActivityType, { label: string; emoji: string; color: string }> = {
  RUN: { label: 'Run', emoji: '🏃', color: '#DC2626' },
  WALK: { label: 'Walk', emoji: '🚶', color: '#059669' },
  CYCLING: { label: 'Cycle', emoji: '🚴', color: '#2563EB' },
};
const ACT_TYPE_ORDER: ActivityType[] = ['RUN', 'WALK', 'CYCLING'];

interface ActivityStatsSectionProps {
  summary: ActivitySummary | null;
  loading: boolean;
  loaded: boolean;
  colors: ThemeColors;
  /** Own profile: shows the history link and an empty state with a start button. */
  isOwn?: boolean;
}

/**
 * Walk/run/cycling stats for a profile's Stats tab, own or a friend's:
 * all-time totals, the activity breakdown, an 8-week progress chart,
 * this week / last 30 days, personal records per type and recent sessions.
 * Everything comes from one /activities/user/{uid}/summary call; the backend
 * returns an empty summary (not an error) when the viewer may not see it.
 */
export function ActivityStatsSection({ summary, loading, loaded, colors, isOwn = false }: ActivityStatsSectionProps) {
  const router = useRouter();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { launch: launchActivity, gate: activityGate } = useActivityLocationGate();

  if (loading && !loaded) {
    return (
      <View style={styles.section}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const bests = summary?.bests ?? {};
  const types = ACT_TYPE_ORDER.filter((t) => bests[t]);

  if (types.length === 0) {
    if (!isOwn || !loaded) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.title}>ACTIVITY STATS</Text>
        <Pressable style={styles.emptyCard} onPress={() => launchActivity('/activity-tracker')} accessibilityRole="button">
          <Footprints color={colors.walkRun} size={22} />
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyTitle}>No walks, runs or rides yet</Text>
            <Text style={styles.emptySub}>Record one and your distance, records and progress appear here.</Text>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </Pressable>
        {activityGate}
      </View>
    );
  }

  const all = types.reduce(
    (acc, t) => {
      const b = bests[t]!;
      acc.count += b.activityCount;
      acc.distance += b.totalDistanceMeters;
      acc.seconds += b.totalDurationSeconds;
      return acc;
    },
    { count: 0, distance: 0, seconds: 0 },
  );
  const trend = summary?.weeklyTrend ?? [];
  const trendMax = Math.max(1, ...trend.map((w) => w.totalDistanceMeters));

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>ACTIVITY STATS</Text>
        {isOwn && (
          <Pressable onPress={() => router.push('/activity-history' as any)} hitSlop={8} style={styles.historyLink} accessibilityRole="link">
            <Text style={styles.historyLinkText}>All activity</Text>
            <ChevronRight color={colors.primary} size={14} strokeWidth={2.6} />
          </Pressable>
        )}
      </View>

      {/* All-time totals */}
      <View style={styles.totalsCard}>
        <Total styles={styles} icon={<Footprints color={colors.primary} size={15} />} value={`${all.count}`} label={all.count === 1 ? 'Activity' : 'Activities'} />
        <View style={styles.vDivider} />
        <Total styles={styles} icon={<MapPin color={colors.primary} size={15} />} value={`${formatDist(all.distance)}`} unit={distUnit(all.distance)} label="Total distance" />
        <View style={styles.vDivider} />
        <Total styles={styles} icon={<Clock color={colors.primary} size={15} />} value={formatDuration(all.seconds)} label="Total time" />
      </View>

      {/* Breakdown by distance share */}
      {types.length > 1 && all.distance > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Breakdown</Text>
          <View style={styles.breakdownBar}>
            {types.map((t) => (
              <View key={t} style={{ flex: Math.max(0.02, bests[t]!.totalDistanceMeters / all.distance), backgroundColor: ACT_META[t].color }} />
            ))}
          </View>
          <View style={styles.legendRow}>
            {types.map((t) => (
              <View key={t} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: ACT_META[t].color }]} />
                <Text style={styles.legendText}>
                  {ACT_META[t].label} {Math.round((bests[t]!.totalDistanceMeters / all.distance) * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 8-week progress */}
      {trend.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <TrendingUp color={colors.primary} size={14} strokeWidth={2.5} />
            <Text style={styles.cardTitle}>Weekly distance · last 8 weeks</Text>
          </View>
          <View style={styles.chart} accessible accessibilityLabel={`Weekly distance, last 8 weeks: ${trend.map((w) => `${formatDist(w.totalDistanceMeters)}${distUnit(w.totalDistanceMeters)}`).join(', ')}`}>
            {trend.map((w, i) => {
              const h = w.totalDistanceMeters > 0 ? Math.max(6, (w.totalDistanceMeters / trendMax) * 84) : 3;
              const current = i === trend.length - 1;
              return (
                <View key={w.weekStart} style={styles.barCol}>
                  <Text style={styles.barValue} numberOfLines={1}>
                    {w.totalDistanceMeters > 0 ? (w.totalDistanceMeters >= 1000 ? (w.totalDistanceMeters / 1000).toFixed(1) : `${Math.round(w.totalDistanceMeters)}m`) : ''}
                  </Text>
                  <View style={[styles.bar, { height: h, backgroundColor: current ? colors.primary : colors.primary + '55' }]} />
                  <Text style={[styles.barLabel, current && { color: colors.primary, fontWeight: '900' }]}>{weekLabel(w.weekStart, current)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.chartUnit}>km per week (Mon–Sun)</Text>
        </View>
      )}

      <View style={styles.progressRow}>
        <ProgressCard styles={styles} colors={colors} label="Last 7 days" progress={summary?.weeklyProgress} />
        <ProgressCard styles={styles} colors={colors} label="Last 30 days" progress={summary?.monthlyProgress} />
      </View>

      {/* Per-type totals + personal records */}
      {types.map((type) => (
        <TypeCard key={type} type={type} b={bests[type]!} styles={styles} colors={colors} />
      ))}

      {(summary?.recentActivities.length ?? 0) > 0 && (
        <View style={[styles.card, { paddingBottom: 4 }]}>
          <Text style={styles.cardTitle}>Recent activity</Text>
          {summary!.recentActivities.slice(0, 5).map((a, idx, arr) => {
            const meta = ACT_META[a.type as ActivityType] ?? ACT_META.RUN;
            return (
              <Pressable
                key={a.serverId ?? a.localId}
                onPress={() => a.serverId && router.push(`/activity/${a.serverId}` as any)}
                style={[styles.recentRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                accessibilityRole="button"
              >
                <View style={[styles.recentIcon, { backgroundColor: meta.color + '1F' }]}>
                  <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentTitle} numberOfLines={1}>{a.title}</Text>
                  <Text style={styles.recentMeta}>
                    {formatDist(a.distanceMeters)}{distUnit(a.distanceMeters)} · {formatDuration(a.durationSeconds)}
                    {a.avgPaceSecPerKm && a.type !== 'CYCLING' ? ` · ${formatPace(a.avgPaceSecPerKm)}/km` : ''}
                    {a.startTime ? ` · ${shortDate(a.startTime)}` : ''}
                  </Text>
                </View>
                <ChevronRight color={colors.textMuted} size={16} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function TypeCard({ type, b, styles, colors }: {
  type: ActivityType; b: ActivityPersonalBests; styles: ReturnType<typeof createStyles>; colors: ThemeColors;
}) {
  const meta = ACT_META[type];
  const cycling = type === 'CYCLING';
  const records: { label: string; value: string }[] = [
    cycling
      ? { label: 'Fastest km', value: b.fastestSplitSpeedKmh != null ? `${b.fastestSplitSpeedKmh.toFixed(1)} km/h` : '—' }
      : { label: 'Fastest km', value: b.fastestSplitPaceSecPerKm != null ? `${formatPace(b.fastestSplitPaceSecPerKm)}/km` : '—' },
    { label: 'Longest', value: b.longestDistanceMeters > 0 ? `${formatDist(b.longestDistanceMeters)}${distUnit(b.longestDistanceMeters)}` : '—' },
    { label: 'Longest time', value: b.longestDurationSeconds > 0 ? formatDuration(b.longestDurationSeconds) : '—' },
  ];
  if (type === 'RUN' && b.fastest400mSeconds != null) records.push({ label: 'Fastest 400m', value: formatDuration(b.fastest400mSeconds) });

  return (
    <View style={styles.card}>
      <View style={styles.typeHeader}>
        <View style={[styles.typeBadge, { backgroundColor: meta.color + '1F' }]}>
          <Text style={{ fontSize: 15 }}>{meta.emoji}</Text>
        </View>
        <Text style={styles.typeLabel}>{meta.label}</Text>
        <Text style={styles.typeTotals}>
          {b.activityCount} · {formatDist(b.totalDistanceMeters)}{distUnit(b.totalDistanceMeters)} · {formatDuration(b.totalDurationSeconds)}
        </Text>
      </View>
      <View style={styles.recordsHeader}>
        <Award color={colors.warning} size={13} strokeWidth={2.5} />
        <Text style={styles.recordsTitle}>Personal records</Text>
      </View>
      <View style={styles.recordsGrid}>
        {records.map((r) => (
          <View key={r.label} style={styles.recordTile}>
            <Text style={styles.recordValue} numberOfLines={1} adjustsFontSizeToFit>{r.value}</Text>
            <Text style={styles.recordLabel}>{r.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ProgressCard({
  label, progress, styles, colors,
}: {
  label: string;
  progress: ActivityPeriodProgress | undefined;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const count = progress?.activityCount ?? 0;
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <TrendingUp color={colors.primary} size={13} strokeWidth={2.5} />
        <Text style={styles.progressLabel}>{label}</Text>
      </View>
      {count > 0 ? (
        <>
          <Text style={styles.progressValue}>
            {formatDist(progress!.totalDistanceMeters)}
            <Text style={styles.progressUnit}> {distUnit(progress!.totalDistanceMeters)}</Text>
          </Text>
          <Text style={styles.progressSub}>{count} {count === 1 ? 'session' : 'sessions'} · {formatDuration(progress!.totalDurationSeconds)}</Text>
        </>
      ) : (
        <Text style={styles.progressEmpty}>No activity yet</Text>
      )}
    </View>
  );
}

function Total({ icon, value, unit, label, styles }: { icon: React.ReactNode; value: string; unit?: string; label: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.total}>
      {icon}
      <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}{unit ? <Text style={styles.totalUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function weekLabel(isoMonday: string, current: boolean) {
  if (current) return 'This wk';
  const [, m, d] = isoMonday.split('-').map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]}`;
}
function shortDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { marginHorizontal: 16, marginBottom: 18, marginTop: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.8 },
  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  historyLinkText: { fontSize: 13, fontWeight: '800', color: colors.primary },

  card: {
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 8 },

  totalsCard: {
    flexDirection: 'row', backgroundColor: colors.cardBg, borderRadius: 16, paddingVertical: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  total: { flex: 1, alignItems: 'center', paddingHorizontal: 6, gap: 3 },
  totalValue: { fontSize: 18, fontWeight: '900', color: colors.text },
  totalUnit: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  totalLabel: { fontSize: 10.5, fontWeight: '700', color: colors.textMuted },
  vDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.divider },

  breakdownBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 122, gap: 6, marginTop: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { fontSize: 9.5, fontWeight: '800', color: colors.textSecondary, marginBottom: 3 },
  bar: { width: '70%', borderRadius: 5 },
  barLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, marginTop: 5 },
  chartUnit: { fontSize: 10.5, color: colors.textMuted, marginTop: 8, textAlign: 'center' },

  progressRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  progressCard: {
    flex: 1, backgroundColor: colors.cardBg, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  progressLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  progressValue: { fontSize: 20, fontWeight: '900', color: colors.text },
  progressUnit: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  progressSub: { fontSize: 11, color: colors.textMuted, marginTop: 3, fontWeight: '600' },
  progressEmpty: { fontSize: 12, color: colors.textMuted, marginTop: 4 },

  typeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  typeBadge: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 15, fontWeight: '900', color: colors.text },
  typeTotals: { flex: 1, textAlign: 'right', fontSize: 11.5, fontWeight: '700', color: colors.textMuted },
  recordsHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  recordsTitle: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.4 },
  recordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recordTile: {
    flexGrow: 1, flexBasis: '30%', backgroundColor: colors.neutral100, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center',
  },
  recordValue: { fontSize: 14, fontWeight: '900', color: colors.text },
  recordLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginTop: 2 },

  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  recentIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  recentTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  recentMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },

  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.cardBg, borderRadius: 16, padding: 16,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  emptySub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
