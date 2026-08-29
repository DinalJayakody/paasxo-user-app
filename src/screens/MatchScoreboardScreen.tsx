import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Clock, Lock, Pause, Play, RotateCcw, Square, Zap } from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { Button } from '../components/Button';
import { bookingApi } from '../api/bookingApi';
import { AuthContext } from '../context/AuthContext';
import { MatchDetails } from '../types/api';
import { parseMatchDetails } from '../utils/parseMatch';
import { useSubscription } from '../hooks/useSubscription';
import { useLiveMatchScore } from '../hooks/useLiveMatchScore';
import { LiveScoreboard } from '../components/scoring/LiveScoreboard';
import { FutsalScoringControls } from '../components/scoring/FutsalScoringControls';
import { CricketScoringControls } from '../components/scoring/CricketScoringControls';
import { RacketScoringControls } from '../components/scoring/RacketScoringControls';
import { LoadingScreen } from '../components/LoadingScreen';

const SPORT_ACCENT: Record<string, string> = {
  FUTSAL: Colors.futsal,
  CRICKET: Colors.cricket,
  PICKLEBALL: Colors.pickleball,
  PADDLEBALL: Colors.paddleball,
};

const SCOREABLE_SPORTS = new Set(['FUTSAL', 'CRICKET', 'PICKLEBALL', 'PADDLEBALL']);

interface MatchScoreboardScreenProps {
  matchId: string;
}

export default function MatchScoreboardScreen({ matchId }: MatchScoreboardScreenProps) {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const { active: isPro, loading: subLoading } = useSubscription();

  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [loadError, setLoadError] = useState<string | undefined>();

  const { score, loading: scoreLoading, actionLoading, error, displaySeconds, startMatch, pauseTimer, resumeTimer, endMatch, resetMatch, updateState } =
    useLiveMatchScore(matchId);

  useEffect(() => {
    let cancelled = false;
    bookingApi.getById(matchId)
      .then((raw) => { if (!cancelled) setMatch(parseMatchDetails(raw)); })
      .catch(() => { if (!cancelled) setLoadError('Could not load this match'); })
      .finally(() => { if (!cancelled) setLoadingMatch(false); });
    return () => { cancelled = true; };
  }, [matchId]);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const isOwner = !!user?.firebaseUid && !!match?.creatorId && user.firebaseUid === match.creatorId;
  const sport = (match?.sportType || 'FUTSAL').toUpperCase();
  const accent = SPORT_ACCENT[sport] || Colors.primary;
  // A freshly created match stays PENDING_VENDOR until the venue accepts it —
  // scoring (and everything else about "the match is happening") only makes
  // sense once that's confirmed. Enforced here too, not just on the button
  // that links here, since this screen is reachable directly by URL/route.
  const isPendingVendor =
    match?.vendorStatus === 'PENDING_VENDOR' ||
    match?.status === 'PENDING_VENDOR' ||
    match?.status === 'PENDING';

  if (loadingMatch || subLoading || scoreLoading) {
    return <LoadingScreen message="Loading scoreboard…" />;
  }

  if (loadError || !match) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Text style={styles.centerText}>{loadError || 'Match not found'}</Text>
        <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  if (!isOwner) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Lock color={Colors.neutral400} size={40} strokeWidth={1.6} />
        <Text style={styles.centerTitle}>Organizer Only</Text>
        <Text style={styles.centerText}>Only the player who created this match can score it.</Text>
        <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  if (isPendingVendor) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <View style={[styles.proLockIcon, { backgroundColor: '#EA580C' }]}>
          <Clock color={Colors.white} size={26} strokeWidth={2.2} />
        </View>
        <Text style={styles.centerTitle}>Awaiting Venue Approval</Text>
        <Text style={styles.centerText}>
          Scoring unlocks once the venue accepts this match. You'll be able to start scoring as soon as it's confirmed.
        </Text>
        <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  if (!isPro) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.proLockIcon}>
          <Zap color={Colors.white} size={26} strokeWidth={2.4} fill={Colors.white} />
        </LinearGradient>
        <Text style={styles.centerTitle}>Pro Feature</Text>
        <Text style={styles.centerText}>Scoring live matches is a Paasxo Pro feature. Upgrade to start scoring this match for everyone watching.</Text>
        <Button title="Upgrade to Pro" onPress={() => router.push('/subscription' as any)} style={{ marginTop: 16 }} />
        <Pressable onPress={() => router.back()} style={{ marginTop: 14 }}>
          <Text style={styles.linkText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const teamAName = 'Team A';
  const teamBName = 'Team B';
  const notStarted = !score || score.status === 'NOT_STARTED';
  const isLive = score?.status === 'LIVE';
  const isPaused = score?.status === 'PAUSED';
  const isDone = score?.status === 'COMPLETED';

  const handleEnd = () => {
    Alert.alert('End Match', 'Finish scoring this match? The final score will be shown to everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Match', style: 'destructive', onPress: () => endMatch().catch(() => {}) },
    ]);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Scoring?',
      'This discards the current score, timer, and match events, and puts scoring back to its starting point. This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => resetMatch().catch(() => {}) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerIconBtn} hitSlop={8}>
          <ArrowLeft color={Colors.neutral900} size={20} strokeWidth={2.2} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{match.title || 'Match Scoring'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {score && (
            <LiveScoreboard score={score} displaySeconds={displaySeconds} teamAName={teamAName} teamBName={teamBName} />
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {notStarted && (
            <Pressable
              style={styles.startBtn}
              onPress={() => startMatch().catch(() => {})}
              disabled={actionLoading}
            >
              <LinearGradient colors={[accent, Colors.primaryDark]} style={styles.startBtnGrad}>
                {actionLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Play color={Colors.white} size={18} strokeWidth={2.6} fill={Colors.white} />
                    <Text style={styles.startBtnText}>Start Match</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          )}

          {(isLive || isPaused) && (
            <View style={styles.controlBar}>
              <Pressable
                style={[styles.controlBtn, { backgroundColor: isPaused ? Colors.success : Colors.warning }]}
                onPress={() => (isPaused ? resumeTimer() : pauseTimer()).catch(() => {})}
                disabled={actionLoading}
              >
                {isPaused ? (
                  <Play color={Colors.white} size={16} strokeWidth={2.6} fill={Colors.white} />
                ) : (
                  <Pause color={Colors.white} size={16} strokeWidth={2.6} fill={Colors.white} />
                )}
                <Text style={styles.controlBtnText}>{isPaused ? 'Resume' : 'Pause'}</Text>
              </Pressable>
              <Pressable style={[styles.controlBtn, { backgroundColor: Colors.liveRed }]} onPress={handleEnd} disabled={actionLoading}>
                <Square color={Colors.white} size={14} strokeWidth={2.6} fill={Colors.white} />
                <Text style={styles.controlBtnText}>End Match</Text>
              </Pressable>
            </View>
          )}

          {(isLive || isPaused) && (
            <Pressable style={styles.resetLink} onPress={handleReset} disabled={actionLoading} hitSlop={6}>
              <RotateCcw color={Colors.textMuted} size={13} strokeWidth={2.2} />
              <Text style={styles.resetLinkText}>Reset scoring to initial state</Text>
            </Pressable>
          )}

          {(isLive || isPaused) && score && SCOREABLE_SPORTS.has(sport) && (
            <View style={styles.panelWrap}>
              {sport === 'FUTSAL' && (
                <FutsalScoringControls
                  score={score}
                  displaySeconds={displaySeconds}
                  teamAName={teamAName}
                  teamBName={teamBName}
                  updating={actionLoading}
                  onUpdateState={updateState}
                />
              )}
              {sport === 'CRICKET' && (
                <CricketScoringControls
                  score={score}
                  teamAName={teamAName}
                  teamBName={teamBName}
                  updating={actionLoading}
                  onUpdateState={updateState}
                />
              )}
              {(sport === 'PICKLEBALL' || sport === 'PADDLEBALL') && (
                <RacketScoringControls
                  score={score}
                  teamAName={teamAName}
                  teamBName={teamBName}
                  accent={accent}
                  updating={actionLoading}
                  onUpdateState={updateState}
                />
              )}
            </View>
          )}

          {(isLive || isPaused) && !SCOREABLE_SPORTS.has(sport) && (
            <View style={styles.unscoreableCard}>
              <Text style={styles.unscoreableText}>Detailed scoring isn't available for {sport.replace('_', ' ')} - use the timer and manual score above.</Text>
            </View>
          )}

          {isDone && (
            <View style={styles.doneCard}>
              <Text style={styles.doneTitle}>Match Complete</Text>
              <Text style={styles.doneSubtitle}>The final score is now visible to everyone viewing this match.</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  centerScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 6, backgroundColor: Colors.background },
  centerTitle: { fontSize: 18, fontWeight: '800', color: Colors.neutral900, marginTop: 10 },
  centerText: { fontSize: 13.5, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  proLockIcon: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  linkText: { color: Colors.primary, fontSize: 13.5, fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.neutral200,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: Colors.neutral900, marginHorizontal: 8 },

  scroll: { paddingHorizontal: 18, paddingBottom: 48, gap: 16 },
  errorText: { color: Colors.error, fontSize: 13, textAlign: 'center', marginTop: 10 },

  startBtn: { marginTop: 16, borderRadius: 18, overflow: 'hidden' },
  startBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  startBtnText: { color: Colors.white, fontSize: 15, fontWeight: '800' },

  controlBar: { flexDirection: 'row', gap: 10, marginTop: 16 },
  resetLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 6,
  },
  resetLinkText: { fontSize: 12.5, fontWeight: '600', color: Colors.textMuted },
  controlBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: 14, paddingVertical: 12,
  },
  controlBtnText: { color: Colors.white, fontSize: 13, fontWeight: '800' },

  panelWrap: { marginTop: 18 },
  unscoreableCard: { marginTop: 16, backgroundColor: Colors.white, borderRadius: 16, padding: 18 },
  unscoreableText: { textAlign: 'center', fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  doneCard: { marginTop: 18, backgroundColor: Colors.white, borderRadius: 18, padding: 20, alignItems: 'center', gap: 6 },
  doneTitle: { fontSize: 16, fontWeight: '800', color: Colors.neutral900 },
  doneSubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});
