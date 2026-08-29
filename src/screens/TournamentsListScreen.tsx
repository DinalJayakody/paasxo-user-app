import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Trophy, MapPin, Crown, Eye } from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { tournamentApi } from '../api/tournamentApi';
import { tournamentStorage, TrackedTournament } from '../utils/tournamentStorage';
import { buildMatchUI, deriveTournamentLifecycle } from '../utils/parseTournament';
import { TournamentLifecycle } from '../types/api';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';

interface ListItem extends TrackedTournament {
  date?: string;
  lifecycle: TournamentLifecycle;
}

export default function TournamentsListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const tracked = await tournamentStorage.getTracked();
      const enriched = await Promise.all(
        tracked.map(async (t) => {
          try {
            const [record, matchRecords] = await Promise.all([
              tournamentApi.getTournament(t.id),
              tournamentApi.listMatches(t.id),
            ]);
            const overrides = await tournamentStorage.getMatchOverrides(t.id);
            const matchesUI = matchRecords.map((m: any) => buildMatchUI(m, new Map(), overrides[String(m.id)]));
            return {
              ...t,
              date: record.date,
              lifecycle: deriveTournamentLifecycle(matchesUI),
            };
          } catch {
            return { ...t, lifecycle: 'UPCOMING' as TournamentLifecycle };
          }
        })
      );
      setItems(enriched);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lifecycleConfig = {
    UPCOMING: { label: 'Upcoming', color: Colors.neutral500, bg: Colors.neutral200 },
    LIVE: { label: 'Live Now', color: '#DC2626', bg: '#FDE8E8' },
    COMPLETED: { label: 'Completed', color: Colors.success, bg: '#E7F8EE' },
  };

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <ArrowLeft color={Colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>My Tournaments</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.refreshableArea}>
      <PaasxoRefreshLogo refreshing={refreshing} />
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <PaasxoRefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyTitle}>No tournaments yet</Text>
            <Text style={styles.emptySubtitle}>
              Create one to organize teams, fixtures, and live scores - or open a tournament link
              someone shared with you.
            </Text>
            <Pressable style={styles.createButton} onPress={() => router.push('/create-tournament' as any)}>
              <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.createButtonGradient}>
                <Trophy color={Colors.white} size={18} strokeWidth={2.5} />
                <Text style={styles.createButtonText}>Create a Tournament</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          items.map((item) => {
            const config = lifecycleConfig[item.lifecycle];
            return (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() => router.push(`/tournament/${item.id}` as any)}
              >
                <View style={styles.cardEmojiWrap}>
                  <Text style={styles.cardEmoji}>🏆</Text>
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <View style={styles.cardMetaRow}>
                    <MapPin color={Colors.textSecondary} size={12} strokeWidth={2} />
                    <Text style={styles.cardMetaText}>{item.date || 'Date TBD'}</Text>
                  </View>
                  <View style={styles.cardBadgeRow}>
                    <View style={[styles.lifecycleBadge, { backgroundColor: config.bg }]}>
                      <Text style={[styles.lifecycleBadgeText, { color: config.color }]}>{config.label}</Text>
                    </View>
                    <View style={styles.roleBadge}>
                      {item.role === 'owner' ? (
                        <Crown color={Colors.primary} size={11} strokeWidth={2.5} />
                      ) : (
                        <Eye color={Colors.neutral500} size={11} strokeWidth={2.5} />
                      )}
                      <Text style={styles.roleBadgeText}>{item.role === 'owner' ? 'Organizer' : 'Following'}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  refreshableArea: { flex: 1, position: 'relative' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    backgroundColor: Colors.background,
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 19,
  },
  createButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  cardEmojiWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 22,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  cardMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lifecycleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  lifecycleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: Colors.neutral100,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.neutral600,
  },
});
