import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Calendar, Users, Trophy, Radio, ChevronRight } from 'lucide-react-native';
import { Colors, ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

export interface TournamentFeedItem {
  id: string | number;
  name: string;
  sport: string;
  date: string;
  venueName?: string;
  teamsCount: number;
  expectedTeams: number;
  lifecycle: 'UPCOMING' | 'LIVE' | 'COMPLETED';
  isOwner?: boolean;
  coverEmoji?: string;
}

const SPORT_CONFIG: Record<string, { emoji: string; color: string; lightColor: string }> = {
  FUTSAL: { emoji: '⚽', color: Colors.futsal, lightColor: Colors.futsalLight },
  CRICKET: { emoji: '🏏', color: Colors.cricket, lightColor: Colors.cricketLight },
  PICKLEBALL: { emoji: '🏓', color: Colors.pickleball, lightColor: Colors.pickleballLight },
};

interface Props {
  tournament: TournamentFeedItem;
  onPress: () => void;
}

export function TournamentFeedCard({ tournament, onPress }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const sport = SPORT_CONFIG[tournament.sport?.toUpperCase()] || SPORT_CONFIG.FUTSAL;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();

    if (tournament.lifecycle === 'LIVE') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [tournament.lifecycle]);

  const lifecycleConfig = {
    UPCOMING: { label: 'UPCOMING', bg: colors.primary + '18', text: colors.primary },
    LIVE: { label: '● LIVE', bg: colors.liveRed + '18', text: colors.liveRed },
    COMPLETED: { label: 'COMPLETED', bg: colors.success + '18', text: colors.success },
  }[tournament.lifecycle];

  const spotsLabel = `${tournament.teamsCount}/${tournament.expectedTeams} teams`;
  const fillPct = Math.min(tournament.teamsCount / Math.max(tournament.expectedTeams, 1), 1);

  return (
    <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Pressable onPress={onPress} style={styles.card}>
        {/* Top gradient accent */}
        <LinearGradient
          colors={[sport.color, sport.color + 'CC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardAccent}
        />

        <View style={styles.cardBody}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.sportBadge}>
              <Text style={styles.sportEmoji}>{sport.emoji}</Text>
              <Text style={[styles.sportLabel, { color: sport.color }]}>{tournament.sport}</Text>
            </View>

            <View style={styles.headerRight}>
              {tournament.lifecycle === 'LIVE' && (
                <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              )}
              <View style={[styles.lifecycleBadge, { backgroundColor: lifecycleConfig.bg }]}>
                <Text style={[styles.lifecycleText, { color: lifecycleConfig.text }]}>
                  {lifecycleConfig.label}
                </Text>
              </View>
              {tournament.isOwner && (
                <View style={styles.ownerBadge}>
                  <Trophy color={colors.primary} size={10} strokeWidth={2.5} />
                  <Text style={styles.ownerBadgeText}>Organiser</Text>
                </View>
              )}
            </View>
          </View>

          {/* Title */}
          <Text style={styles.tournamentName} numberOfLines={2}>{tournament.name}</Text>

          {/* Meta */}
          <View style={styles.metaRow}>
            {tournament.venueName && (
              <View style={styles.metaItem}>
                <MapPin color={colors.textMuted} size={13} strokeWidth={2} />
                <Text style={styles.metaText} numberOfLines={1}>{tournament.venueName}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Calendar color={colors.textMuted} size={13} strokeWidth={2} />
              <Text style={styles.metaText}>{tournament.date}</Text>
            </View>
          </View>

          {/* Teams progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <View style={styles.progressLabel}>
                <Users color={colors.textSecondary} size={13} strokeWidth={2} />
                <Text style={styles.progressText}>{spotsLabel}</Text>
              </View>
              <Text style={styles.progressPct}>{Math.round(fillPct * 100)}% full</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${fillPct * 100}%`, backgroundColor: sport.color }]} />
            </View>
          </View>

          {/* CTA */}
          <Pressable onPress={onPress} style={[styles.ctaButton, { backgroundColor: sport.color }]}>
            <Text style={styles.ctaText}>
              {tournament.lifecycle === 'UPCOMING' ? 'View & Join' : tournament.lifecycle === 'LIVE' ? 'Watch Live' : 'View Results'}
            </Text>
            <ChevronRight color={colors.white} size={14} strokeWidth={2.5} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg, borderRadius: 20, marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09, shadowRadius: 16, elevation: 5,
  },
  cardAccent: { height: 4, width: '100%' },
  cardBody: { padding: 16 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sportBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sportEmoji: { fontSize: 18 },
  sportLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.liveRed },
  lifecycleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  lifecycleText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  ownerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.primaryLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  ownerBadgeText: { fontSize: 9, fontWeight: '700', color: colors.primary },

  tournamentName: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 10, lineHeight: 22 },

  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

  progressSection: { marginBottom: 14 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  progressText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  progressPct: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  progressBarBg: { height: 6, backgroundColor: colors.neutral100, borderRadius: 3 },
  progressBarFill: { height: 6, borderRadius: 3 },

  ctaButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12,
  },
  ctaText: { fontSize: 13, fontWeight: '700', color: colors.white },
});
