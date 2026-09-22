import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, TrendingUp } from 'lucide-react-native';
import { ThemeColors } from '../../styles/colors';
import { ActivitySummary, ActivityPeriodProgress } from '../../api/activityApi';
import { formatDist, distUnit, formatPace, formatTime as formatDuration } from '../../utils/activityMath';

const ACT_TYPE_LABEL: Record<string, string> = { WALK: '🚶 Walk', RUN: '🏃 Run', CYCLING: '🚴 Cycle' };
const ACT_TYPE_ORDER = ['RUN', 'WALK', 'CYCLING'] as const;

interface ActivityStatsSectionProps {
  summary: ActivitySummary | null;
  loading: boolean;
  loaded: boolean;
  colors: ThemeColors;
}

/**
 * Real walk/run/cycling Activity data for a profile's Stats tab — own or a
 * friend's (the backend already returns an empty summary rather than an
 * error when the viewer isn't allowed to see it, see
 * ActivityService#getUserSummary, so this renders nothing rather than an
 * error state in that case). Shared by ProfileScreen and FriendProfileScreen
 * so both stay in sync rather than drifting as two near-identical copies.
 */
export function ActivityStatsSection({ summary, loading, loaded, colors }: ActivityStatsSectionProps) {
  const router = useRouter();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  if (loading && !loaded) {
    return (
      <View style={styles.section}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const bests = summary?.bests ?? {};
  if (Object.keys(bests).length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Activity Stats</Text>

      <View style={styles.progressRow}>
        <ProgressCard styles={styles} colors={colors} label="This Week" progress={summary?.weeklyProgress} />
        <ProgressCard styles={styles} colors={colors} label="This Month" progress={summary?.monthlyProgress} />
      </View>

      {ACT_TYPE_ORDER.map((type) => {
        const b = bests[type];
        if (!b) return null;
        const isPaceBased = type !== 'CYCLING';
        return (
          <View key={type} style={styles.typeCard}>
            <Text style={styles.typeLabel}>{ACT_TYPE_LABEL[type]}</Text>
            <View style={styles.statRow}>
              <MiniStat styles={styles} label="Sessions" value={`${b.activityCount}`} />
              <MiniStat styles={styles} label="Distance" value={`${formatDist(b.totalDistanceMeters)}${distUnit(b.totalDistanceMeters)}`} />
              <MiniStat styles={styles} label="Time" value={formatDuration(b.totalDurationSeconds)} />
              <MiniStat
                styles={styles}
                label="Best km"
                value={isPaceBased
                  ? (b.fastestSplitPaceSecPerKm != null ? `${formatPace(b.fastestSplitPaceSecPerKm)}/km` : '—')
                  : (b.fastestSplitSpeedKmh != null ? `${b.fastestSplitSpeedKmh.toFixed(1)}km/h` : '—')}
              />
            </View>
          </View>
        );
      })}

      {(summary?.recentActivities.length ?? 0) > 0 && (
        <View style={{ marginTop: 4 }}>
          <Text style={styles.recentHeading}>Recent Activity</Text>
          {summary!.recentActivities.slice(0, 5).map((a) => (
            <Pressable
              key={a.serverId ?? a.localId}
              onPress={() => a.serverId && router.push(`/activity/${a.serverId}` as any)}
              style={styles.recentRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle} numberOfLines={1}>{a.title}</Text>
                <Text style={styles.recentMeta}>
                  {formatDist(a.distanceMeters)}{distUnit(a.distanceMeters)} · {formatDuration(a.durationSeconds)}
                </Text>
              </View>
              <ChevronRight color={colors.textMuted} size={16} />
            </Pressable>
          ))}
        </View>
      )}
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

function MiniStat({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { marginHorizontal: 16, marginBottom: 18, marginTop: 8 },
  title: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },
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
  typeCard: {
    backgroundColor: colors.cardBg, borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  typeLabel: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 10 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  miniStat: { alignItems: 'center', flex: 1 },
  miniStatValue: { fontSize: 14, fontWeight: '900', color: colors.text },
  miniStatLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginTop: 2 },
  recentHeading: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginBottom: 6 },
  recentRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  recentTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  recentMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
