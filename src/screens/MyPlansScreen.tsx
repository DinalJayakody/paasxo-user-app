import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../styles/colors';
import { trainerApi } from '../api/trainerApi';
import { TrainerPlanPurchase } from '../types/api';
import { extractApiError } from '../utils/apiError';
import { goBack } from '../utils/navigation';
import { PLAN_TYPE_LABEL, PlanIcon } from './TrainerPlanScreen';

/** The user's bought workout/diet plans and memberships. */
export default function MyPlansScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [items, setItems] = useState<TrainerPlanPurchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try { setItems(await trainerApi.getMyPlanPurchases()); }
    catch (e) { setError(extractApiError(e, 'Could not load your plans.')); setItems((x) => x ?? []); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const now = Date.now();
  const active = (items ?? []).filter((p) => p.status === 'ACTIVE' && new Date(p.expiresAt).getTime() > now);
  const past = (items ?? []).filter((p) => !active.includes(p));
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const row = (p: TrainerPlanPurchase, dim = false) => (
    <Pressable key={p.id} style={[s.card, dim && { opacity: 0.6 }]} onPress={() => router.push(`/trainer-plan/${p.planId}` as any)}
      accessibilityRole="button">
      <View style={s.icon}><PlanIcon type={p.planType} color={colors.trainer} size={20} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.kicker}>{(PLAN_TYPE_LABEL[p.planType] ?? 'Plan').toUpperCase()}</Text>
        <Text style={s.title} numberOfLines={1}>{p.planTitle}</Text>
        <Text style={s.meta} numberOfLines={1}>
          {p.trainerDisplayName ? `${p.trainerDisplayName} · ` : ''}
          {p.status === 'CANCELLED' ? 'Cancelled' : dim ? `Ended ${fmt(p.expiresAt)}` : `Until ${fmt(p.expiresAt)}`}
        </Text>
        {!dim && p.planType !== 'MEMBERSHIP' && (p.personalContent || p.personalised || p.assignedByTrainer) && (
          <Text style={[s.personal, { color: p.personalContent ? colors.success : colors.trainer }]} numberOfLines={1}>
            {p.personalContent ? '✓ Your personal plan is ready' : 'Your trainer is preparing your plan'}
          </Text>
        )}
      </View>
      <ChevronRight color={colors.textMuted} size={18} />
    </Pressable>
  );

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => goBack(router)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft color={colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <Text style={s.headerTitle}>My plans & memberships</Text>
        <View style={{ width: 22 }} />
      </View>
      {items == null ? (
        <ActivityIndicator color={colors.trainer} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        >
          {!!error && <Text style={s.error}>{error}</Text>}
          {items.length === 0 && !error ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No plans yet</Text>
              <Text style={s.emptyText}>Workout plans, diet plans and memberships you get from trainers show up here.</Text>
            </View>
          ) : (
            <>
              {active.length > 0 && <Text style={s.section}>Active</Text>}
              {active.map((p) => row(p))}
              {past.length > 0 && <Text style={s.section}>Past</Text>}
              {past.map((p) => row(p, true))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  scroll: { padding: 20, paddingTop: 4, gap: 10 },
  section: { fontSize: 13, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.6, marginTop: 10, textTransform: 'uppercase' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.divider,
  },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.trainer + '18', alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 10.5, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.6 },
  title: { fontSize: 15.5, fontWeight: '800', color: colors.text, marginTop: 1 },
  meta: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  personal: { fontSize: 12.5, fontWeight: '700', marginTop: 3 },
  error: { color: colors.error, textAlign: 'center', marginBottom: 8 },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});
