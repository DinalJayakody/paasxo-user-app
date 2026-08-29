import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Flame, Clock, TrendingUp, Wind,
  PersonStanding, Trophy, ChevronRight, Zap,
} from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { activityStorage, activityApi, StoredActivity, ActivityType } from '../api/activityApi';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';

const { width: SCREEN_W } = Dimensions.get('window');

type FilterType = 'ALL' | ActivityType;

const ACT_CFG = {
  WALK: { label: 'Walk', emoji: '🚶', colors: ['#059669', '#047857'] as [string, string], accent: '#059669' },
  RUN:  { label: 'Run',  emoji: '🏃', colors: ['#DC2626', '#991B1B'] as [string, string], accent: '#DC2626' },
  CYCLING: { label: 'Cycle', emoji: '🚴', colors: ['#2563EB', '#1D4ED8'] as [string, string], accent: '#2563EB' },
};

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeOfDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Group activities by date label
function groupByDate(activities: StoredActivity[]): { date: string; items: StoredActivity[] }[] {
  const groups: Record<string, StoredActivity[]> = {};
  for (const a of activities) {
    const key = new Date(a.startTime).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }
  return Object.entries(groups).map(([date, items]) => ({ date, items }));
}

// Weekly totals
function weeklyStats(activities: StoredActivity[]) {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const week = activities.filter((a) => new Date(a.startTime).getTime() > oneWeekAgo);
  return {
    count: week.length,
    totalDistM: week.reduce((s, a) => s + a.distanceMeters, 0),
    totalSecs: week.reduce((s, a) => s + a.durationSeconds, 0),
    totalCal: week.reduce((s, a) => s + a.estimatedCalories, 0),
  };
}

// ── Animated stat card ────────────────────────────────────────────────────────
const AnimatedStatCard = ({ label, value, delay }: { label: string; value: string; delay: number }) => {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.weekStatItem, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.weekStatValue}>{value}</Text>
      <Text style={styles.weekStatLabel}>{label}</Text>
    </Animated.View>
  );
};

export default function ActivityHistoryScreen() {
  const router = useRouter();
  const [activities, setActivities] = useState<StoredActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('ALL');

  const loadActivities = useCallback(async () => {
    const local = await activityStorage.getAll();
    const remote = await activityApi.getMyActivities();

    // Merge: remote ones might have serverId, local might not
    const localIds = new Set(local.map((a) => a.localId));
    const merged = [...local];
    for (const r of remote) {
      if (!localIds.has(r.localId)) merged.push(r);
    }
    merged.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    setActivities(merged);
    setLoading(false);
  }, []);

  useEffect(() => { loadActivities(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  }, [loadActivities]);

  const filtered = filter === 'ALL' ? activities : activities.filter((a) => a.type === filter);
  const groups = groupByDate(filtered);
  const ws = weeklyStats(activities);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={20} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>My Activities</Text>
          <Text style={styles.headerSub}>{activities.length} total recorded</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/activity-tracker' as any)}
          style={styles.startBtn}
        >
          <Text style={styles.startBtnText}>+ Start</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.refreshableArea}>
      <PaasxoRefreshLogo refreshing={refreshing} />
      <ScrollView
        refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Weekly stats */}
        <View style={styles.weekSection}>
          <View style={styles.weekHeader}>
            <Zap color="#F59E0B" size={16} strokeWidth={2.5} />
            <Text style={styles.weekTitle}>This Week</Text>
          </View>
          <View style={styles.weekGrid}>
            <AnimatedStatCard label="Activities" value={`${ws.count}`} delay={0} />
            <AnimatedStatCard label="Distance" value={formatDist(ws.totalDistM)} delay={100} />
            <AnimatedStatCard label="Time" value={formatTime(ws.totalSecs)} delay={200} />
            <AnimatedStatCard label="Calories" value={`${ws.totalCal} kcal`} delay={300} />
          </View>
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {(['ALL', 'WALK', 'RUN', 'CYCLING'] as FilterType[]).map((f) => {
            const selected = filter === f;
            const label = f === 'ALL' ? 'All' : ACT_CFG[f].emoji + ' ' + ACT_CFG[f].label;
            const accent = f === 'ALL' ? Colors.primary : ACT_CFG[f].accent;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterTab, selected && { backgroundColor: accent }]}
              >
                <Text style={[styles.filterTabText, selected && { color: Colors.white }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Guide text when empty */}
        {!loading && filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>🏃</Text>
            <Text style={styles.emptyTitle}>No activities yet</Text>
            <Text style={styles.emptySub}>
              {filter !== 'ALL'
                ? `No ${ACT_CFG[filter as ActivityType]?.label} activities recorded.`
                : 'Start your first activity and it will appear here. Every step counts!'}
            </Text>
            <TouchableOpacity
              style={styles.emptyStartBtn}
              onPress={() => router.push('/activity-tracker' as any)}
            >
              <LinearGradient colors={['#059669', '#047857']} style={styles.emptyStartGrad}>
                <Text style={styles.emptyStartText}>Start First Activity</Text>
                <ChevronRight color={Colors.white} size={18} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Activity groups */}
        {groups.map(({ date, items }) => (
          <View key={date} style={styles.group}>
            <Text style={styles.groupDate}>
              {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            {items.map((activity) => (
              <ActivityCard
                key={activity.localId}
                activity={activity}
                onPress={() => router.push(`/activity/${activity.localId}` as any)}
              />
            ))}
          </View>
        ))}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ActivityCard({ activity, onPress }: { activity: StoredActivity; onPress: () => void }) {
  const cfg = ACT_CFG[activity.type];
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.actCard}>
        {/* Left accent */}
        <View style={[styles.actCardAccent, { backgroundColor: cfg.accent }]} />
        <View style={styles.actCardBody}>
          {/* Top row */}
          <View style={styles.actCardTop}>
            <View style={[styles.actTypeTag, { backgroundColor: cfg.accent + '22' }]}>
              <Text style={{ fontSize: 15 }}>{cfg.emoji}</Text>
              <Text style={[styles.actTypeTagText, { color: cfg.accent }]}>{cfg.label}</Text>
            </View>
            <Text style={styles.actCardTime}>{formatTimeOfDay(activity.startTime)}</Text>
          </View>
          {/* Title */}
          <Text style={styles.actCardTitle}>{activity.title}</Text>
          {/* Stats row */}
          <View style={styles.actCardStats}>
            <MiniStat icon={<Wind color={Colors.neutral400} size={12} />} value={formatDist(activity.distanceMeters)} />
            <MiniStat icon={<Clock color={Colors.neutral400} size={12} />} value={formatTime(activity.durationSeconds)} />
            <MiniStat icon={<Zap color={Colors.neutral400} size={12} />} value={`${activity.avgSpeedKmh.toFixed(1)} km/h`} />
            <MiniStat icon={<Flame color={Colors.neutral400} size={12} />} value={`${activity.estimatedCalories} kcal`} />
          </View>
        </View>
        <ChevronRight color={Colors.neutral400} size={18} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function MiniStat({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <View style={styles.miniStat}>
      {icon}
      <Text style={styles.miniStatText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  refreshableArea: { flex: 1, position: 'relative' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: Colors.white },
  headerSub: { fontSize: 12, color: Colors.neutral500, marginTop: 2 },
  startBtn: { backgroundColor: '#059669', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  startBtnText: { fontSize: 13, fontWeight: '800', color: Colors.white },

  weekSection: { margin: 16, backgroundColor: '#1E293B', borderRadius: 20, padding: 16 },
  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  weekTitle: { fontSize: 14, fontWeight: '800', color: Colors.white },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  weekStatItem: {
    width: (SCREEN_W - 80) / 2,
    backgroundColor: '#0F172A', borderRadius: 14, padding: 12,
  },
  weekStatValue: { fontSize: 18, fontWeight: '900', color: Colors.white, marginBottom: 2 },
  weekStatLabel: { fontSize: 11, color: Colors.neutral500, fontWeight: '600' },

  filterScroll: { marginBottom: 8 },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
  },
  filterTabText: { fontSize: 13, fontWeight: '700', color: Colors.neutral400 },

  group: { paddingHorizontal: 16, marginBottom: 8 },
  groupDate: { fontSize: 12, fontWeight: '700', color: Colors.neutral500, letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },

  actCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', borderRadius: 18, marginBottom: 10,
    overflow: 'hidden', paddingRight: 14,
  },
  actCardAccent: { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  actCardBody: { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  actCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  actTypeTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  actTypeTagText: { fontSize: 12, fontWeight: '800' },
  actCardTime: { fontSize: 11, color: Colors.neutral500, fontWeight: '600' },
  actCardTitle: { fontSize: 15, fontWeight: '800', color: Colors.white, marginBottom: 8 },
  actCardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniStatText: { fontSize: 12, color: Colors.neutral400, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, paddingBottom: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: Colors.white, marginBottom: 10 },
  emptySub: { fontSize: 14, color: Colors.neutral500, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyStartBtn: { borderRadius: 16, overflow: 'hidden' },
  emptyStartGrad: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14 },
  emptyStartText: { fontSize: 15, fontWeight: '800', color: Colors.white },
});
