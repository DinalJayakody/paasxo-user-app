import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, Trophy } from 'lucide-react-native';
import { Colors } from '../../styles/colors';
import { MatchScoreState } from '../../types/api';
import { formatMatchDuration } from '../../utils/matchTimer';

interface LiveScoreboardProps {
  score: MatchScoreState;
  displaySeconds: number;
  teamAName?: string;
  teamBName?: string;
  loading?: boolean;
}

const SPORT_COLOR: Record<string, string> = {
  FUTSAL: Colors.futsal,
  CRICKET: Colors.cricket,
  PICKLEBALL: Colors.pickleball,
  PADDLEBALL: Colors.paddleball,
};

function sportSubline(score: MatchScoreState): string {
  const s = score.state || {};
  switch (score.sport) {
    case 'CRICKET': {
      const innings = Array.isArray(s.innings) ? s.innings[s.currentInnings ? s.currentInnings - 1 : 0] : null;
      if (!innings) return 'Match not yet underway';
      const overs = `${innings.overs ?? 0}.${innings.balls ?? 0}`;
      return `Innings ${s.currentInnings ?? 1} • Overs ${overs} • ${innings.wickets ?? 0} wkts`;
    }
    case 'PICKLEBALL':
    case 'PADDLEBALL': {
      const setsA = s.setsA ?? 0;
      const setsB = s.setsB ?? 0;
      return `Sets ${setsA} - ${setsB} • Race to ${s.pointsToWin ?? 11}`;
    }
    case 'FUTSAL':
    default: {
      const half = s.half ?? 1;
      return half === 2 ? '2nd Half' : '1st Half';
    }
  }
}

function PulsingDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.8, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotPulse, { backgroundColor: color, transform: [{ scale: pulse }] }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

export function LiveScoreboard({ score, displaySeconds, teamAName = 'Team A', teamBName = 'Team B' }: LiveScoreboardProps) {
  const accent = SPORT_COLOR[score.sport] || Colors.primary;
  const isLive = score.status === 'LIVE';
  const isPaused = score.status === 'PAUSED';
  const isDone = score.status === 'COMPLETED';
  const notStarted = score.status === 'NOT_STARTED';

  const statusLabel = isDone ? 'FULL TIME' : isPaused ? 'PAUSED' : isLive ? 'LIVE' : 'NOT STARTED';
  const statusColor = isDone ? Colors.neutral500 : isPaused ? Colors.warning : isLive ? Colors.liveRed : Colors.neutral400;

  return (
    <LinearGradient colors={[accent + '22', Colors.white]} style={styles.card}>
      <View style={styles.statusRow}>
        <View style={styles.statusBadge}>
          {isLive ? <PulsingDot color={statusColor} /> : <View style={[styles.dot, { backgroundColor: statusColor }]} />}
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        {!notStarted && (
          <View style={styles.timerBadge}>
            <Clock color={Colors.neutral700} size={13} strokeWidth={2.4} />
            <Text style={styles.timerText}>{formatMatchDuration(displaySeconds)}</Text>
          </View>
        )}
      </View>

      {notStarted ? (
        <View style={styles.idleWrap}>
          <Trophy color={accent} size={26} strokeWidth={1.8} />
          <Text style={styles.idleText}>Scoring hasn't started yet</Text>
        </View>
      ) : (
        <>
          <View style={styles.scoreRow}>
            <View style={styles.teamBlock}>
              <Text style={styles.teamName} numberOfLines={1}>{teamAName}</Text>
              <Text style={[styles.scoreValue, { color: accent }]}>{score.teamAScore}</Text>
            </View>
            <Text style={styles.vsText}>-</Text>
            <View style={styles.teamBlock}>
              <Text style={styles.teamName} numberOfLines={1}>{teamBName}</Text>
              <Text style={[styles.scoreValue, { color: accent }]}>{score.teamBScore}</Text>
            </View>
          </View>
          <Text style={styles.subline}>{sportSubline(score)}</Text>
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.neutral200 + '80',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusText: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  dotWrap: { width: 9, height: 9, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotPulse: { position: 'absolute', width: 8, height: 8, borderRadius: 4, opacity: 0.4 },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.white, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  timerText: { fontSize: 13, fontWeight: '800', color: Colors.neutral800, fontVariant: ['tabular-nums'] },

  idleWrap: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  idleText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  teamBlock: { flex: 1, alignItems: 'center', gap: 4, maxWidth: 130 },
  teamName: { fontSize: 12, fontWeight: '700', color: Colors.neutral600, textTransform: 'uppercase', letterSpacing: 0.4 },
  scoreValue: { fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] },
  vsText: { fontSize: 20, fontWeight: '700', color: Colors.neutral300 },
  subline: { textAlign: 'center', marginTop: 12, fontSize: 12.5, fontWeight: '700', color: Colors.neutral600 },
});
