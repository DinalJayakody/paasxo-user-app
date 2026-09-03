import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Award, ChevronRight, Clock, MapPin, Star, Users, Wallet,
} from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { trainerApi } from '../api/trainerApi';
import { TrainerProfile, TrainerSession } from '../types/api';
import { resolveAvatarUri, resolveMediaUrl } from '../utils/mediaUrl';
import TrainerHeroMascot from '../components/TrainerHeroMascot';
import { LoadingScreen } from '../components/LoadingScreen';
import { PaasxoRefreshControl } from '../components/PaasxoRefreshControl';
import { PaasxoRefreshLogo } from '../components/PaasxoRefreshLogo';
import ScreenGlow from '../components/ScreenGlow';

const CATEGORY_LABELS: Record<string, string> = {
  GYM: 'Gym', CALISTHENICS: 'Calisthenics', DANCING: 'Dancing', YOGA: 'Yoga',
  CROSSFIT: 'CrossFit', MARTIAL_ARTS: 'Martial Arts', PILATES: 'Pilates', OTHER: 'Training',
};

const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
};

function timeLabel(t: string) {
  return t.slice(0, 5);
}

interface Props {
  trainerId: string;
}

export default function TrainerProfileScreen({ trainerId }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [sessions, setSessions] = useState<TrainerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const p: TrainerProfile = await trainerApi.getById(trainerId);
      setProfile(p);
      const s: TrainerSession[] = await trainerApi.getSessionsForTrainer(p.trainerFirebaseUid);
      setSessions(s.filter((sess) => sess.active));
    } catch (err) {
      console.warn('Failed to load trainer profile', err);
      setError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [trainerId]);

  useEffect(() => { load(); }, [load]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  };

  if (error) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ScreenGlow />
        <Text style={styles.errorText}>Couldn't load this trainer's profile.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => load()} activeOpacity={0.85}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loading || !profile) {
    return <LoadingScreen message="Loading trainer profile…" />;
  }

  const coverUri = resolveMediaUrl(profile.coverImageUrl);
  const avatarUri = resolveAvatarUri(profile.profileImageUrl, profile.trainerDisplayName);

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <ScreenGlow />
      <PaasxoRefreshLogo refreshing={refreshing} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<PaasxoRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.hero}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.heroImage} />
          ) : (
            <LinearGradient colors={[colors.trainer, colors.primaryDark]} style={styles.heroImage} />
          )}
          <View style={styles.heroScrim} />
          <TouchableOpacity style={styles.backFab} onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft color={colors.text} size={20} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.heroMascotWrap}>
            <TrainerHeroMascot size={84} />
          </View>
        </View>

        <View style={styles.profileHeader}>
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
          <View style={styles.flex1}>
            <Text style={styles.name}>{profile.trainerDisplayName || 'Trainer'}</Text>
            {!!profile.location && (
              <View style={styles.metaRow}>
                <MapPin color={colors.textMuted} size={13} strokeWidth={2} />
                <Text style={styles.metaText}>{profile.location}</Text>
              </View>
            )}
          </View>
          {profile.rating != null && (
            <View style={styles.ratingPill}>
              <Star color="#F59E0B" size={13} fill="#F59E0B" />
              <Text style={styles.ratingText}>{profile.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        <View style={styles.chipRow}>
          {(profile.categories ?? []).map((c) => (
            <View key={c} style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{CATEGORY_LABELS[c] ?? c}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statRow}>
          {profile.experienceYears != null && (
            <View style={styles.statCard}>
              <Award color={colors.trainer} size={18} strokeWidth={2} />
              <Text style={styles.statValue}>{profile.experienceYears}yr</Text>
              <Text style={styles.statLabel}>Experience</Text>
            </View>
          )}
          {profile.hourlyRate != null && (
            <View style={styles.statCard}>
              <Wallet color={colors.trainer} size={18} strokeWidth={2} />
              <Text style={styles.statValue}>LKR {profile.hourlyRate}</Text>
              <Text style={styles.statLabel}>Hourly Rate</Text>
            </View>
          )}
          <View style={styles.statCard}>
            <Users color={colors.trainer} size={18} strokeWidth={2} />
            <Text style={styles.statValue}>{sessions.length}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
        </View>

        {!!profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bodyText}>{profile.bio}</Text>
          </View>
        )}

        {!!profile.certifications && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Certifications</Text>
            <Text style={styles.bodyText}>{profile.certifications}</Text>
          </View>
        )}

        {profile.galleryImageUrls != null && profile.galleryImageUrls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gallery</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {profile.galleryImageUrls.map((g, i) => (
                <Image key={i} source={{ uri: resolveMediaUrl(g) }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sessions</Text>
          {sessions.length === 0 ? (
            <Text style={styles.emptyText}>No sessions available yet — check back soon.</Text>
          ) : (
            sessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                activeOpacity={0.88}
                onPress={() => router.push(`/trainer-session/${session.id}` as any)}
              >
                {session.imageUrl ? (
                  <Image source={{ uri: resolveMediaUrl(session.imageUrl) }} style={styles.sessionImage} />
                ) : (
                  <LinearGradient colors={[colors.trainerLight, colors.trainerLight]} style={styles.sessionImage} />
                )}
                <View style={styles.sessionBody}>
                  <Text style={styles.sessionTitle} numberOfLines={1}>{session.title}</Text>
                  <View style={styles.metaRow}>
                    <Clock color={colors.textMuted} size={12} strokeWidth={2} />
                    <Text style={styles.metaText}>
                      {session.daysOfWeek.map((d) => DAY_SHORT[d] ?? d).join(', ')} · {timeLabel(session.startTime)}
                    </Text>
                  </View>
                  <View style={styles.sessionFooterRow}>
                    <Text style={styles.sessionPrice}>LKR {session.price} / session</Text>
                    <ChevronRight color={colors.trainer} size={16} strokeWidth={2.5} />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex1: { flex: 1, backgroundColor: colors.background },
  loadingScreen: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  errorText: { fontSize: 14.5, color: colors.textSecondary, textAlign: 'center' },
  retryButton: { backgroundColor: colors.trainer, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryButtonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  hero: { height: 190, backgroundColor: colors.trainerLight },
  heroImage: { width: '100%', height: '100%' },
  heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, backgroundColor: 'rgba(20,10,0,0.25)' },
  backFab: {
    position: 'absolute', top: 12, left: 16, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
  },
  heroMascotWrap: { position: 'absolute', right: 16, bottom: -8 },
  profileHeader: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, marginTop: -36, gap: 12,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: colors.white, backgroundColor: colors.neutral100,
  },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12.5, color: colors.textMuted },
  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.cardBg,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  ratingText: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 14 },
  categoryChip: { backgroundColor: colors.trainerLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  categoryChipText: { fontSize: 12.5, fontWeight: '700', color: colors.trainer },
  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 16 },
  statCard: {
    flex: 1, backgroundColor: colors.cardBg, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  statValue: { fontSize: 14, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10.5, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  section: { paddingHorizontal: 20, marginTop: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  bodyText: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  emptyText: { fontSize: 13.5, color: colors.textMuted },
  galleryImage: { width: 130, height: 100, borderRadius: 12, backgroundColor: colors.neutral100 },
  sessionCard: {
    flexDirection: 'row', backgroundColor: colors.cardBg, borderRadius: 16, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  sessionImage: { width: 88, height: 88 },
  sessionBody: { flex: 1, padding: 12, justifyContent: 'space-between' },
  sessionTitle: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  sessionFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sessionPrice: { fontSize: 13, fontWeight: '800', color: colors.trainer },
});
