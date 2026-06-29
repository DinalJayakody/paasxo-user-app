import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Plus,
  Minus,
  Play,
  Flag,
  PartyPopper,
  Target,
  Shield,
  Activity,
  Users,
  ChevronDown,
  Radio,
  Award,
  X,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../styles/colors';
import { SubscriptionGate } from '../components/SubscriptionGate';
import { AuthContext } from '../context/AuthContext';
import { tournamentApi } from '../api/tournamentApi';
import { tournamentStorage } from '../utils/tournamentStorage';
import { buildTeamUI, buildMatchUI } from '../utils/parseTournament';
import { TournamentMatchUI, TournamentTeamUI } from '../types/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type Sport = 'FUTSAL' | 'CRICKET' | 'PICKLEBALL';

interface FutsalEvent {
  type: 'GOAL' | 'ASSIST' | 'YELLOW' | 'RED' | 'SAVE';
  team: 'A' | 'B';
  player: string;
  minute: number;
}

interface CricketBallEvent {
  runs: number;
  isWicket: boolean;
  isWide: boolean;
  isNoBall: boolean;
  isBye: boolean;
  isLegBye: boolean;
  bowler: string;
  batsman: string;
}

interface CricketInnings {
  battingTeam: 'A' | 'B';
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  extras: { wides: number; noBalls: number; byes: number; legByes: number };
  events: CricketBallEvent[];
}

interface PickleballGame {
  scoreA: number;
  scoreB: number;
  winner: 'A' | 'B' | null;
}

interface PlayerStat {
  playerId: string;
  playerName: string;
  goals?: number;
  assists?: number;
  yellowCards?: number;
  redCards?: number;
  saves?: number;
  runs?: number;
  balls?: number;
  wickets?: number;
  catches?: number;
  fours?: number;
  sixes?: number;
  aces?: number;
  errors?: number;
}

interface MatchScoringScreenProps {
  tournamentId?: string;
  matchId?: string;
  normalMatchId?: string;
}

const SPORT_COLORS: Record<Sport, string> = {
  FUTSAL: Colors.futsal,
  CRICKET: Colors.cricket,
  PICKLEBALL: Colors.pickleball,
};

// ─── Helper: derive sport from tournament data ────────────────────────────────
function guessSport(): Sport {
  return 'FUTSAL'; // default; ideally comes from tournament record
}

export default function MatchScoringScreen({ tournamentId = '', matchId = '', normalMatchId }: MatchScoringScreenProps) {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [match, setMatch] = useState<TournamentMatchUI | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [celebrating, setCelebrating] = useState(false);
  const [sport, setSport] = useState<Sport>('FUTSAL');
  const [activeTab, setActiveTab] = useState<'SCORE' | 'EVENTS' | 'STATS'>('SCORE');

  // Animated values
  const scoreAScale = useRef(new Animated.Value(1)).current;
  const scoreBScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const celebrateAnim = useRef(new Animated.Value(0)).current;
  const tabSlide = useRef(new Animated.Value(0)).current;

  // Futsal state
  const [futsalEvents, setFutsalEvents] = useState<FutsalEvent[]>([]);
  const [matchMinute, setMatchMinute] = useState(0);
  const [eventModal, setEventModal] = useState(false);
  const [eventType, setEventType] = useState<FutsalEvent['type']>('GOAL');
  const [eventTeam, setEventTeam] = useState<'A' | 'B'>('A');
  const [eventPlayer, setEventPlayer] = useState('');

  // Cricket state
  const [cricketInnings, setCricketInnings] = useState<CricketInnings[]>([]);
  const [currentInnings, setCurrentInnings] = useState(0);
  const [totalOvers, setTotalOvers] = useState(20);
  const [cricketModal, setCricketModal] = useState(false);
  const [currentBatsman, setCurrentBatsman] = useState('');
  const [currentBowler, setCurrentBowler] = useState('');

  // Pickleball state
  const [pickleballGames, setPickleballGames] = useState<PickleballGame[]>([{ scoreA: 0, scoreB: 0, winner: null }]);
  const [currentGame, setCurrentGame] = useState(0);
  const [setsA, setSetsA] = useState(0);
  const [setsB, setSetsB] = useState(0);

  // Player stats
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);

  // ─── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async (silent = false) => {
    // Normal match mode — synthetic teams, no tournament API
    if (normalMatchId) {
      const saved = await AsyncStorage.getItem(`normal_match_score_${normalMatchId}`).catch(() => null);
      const scores = saved ? JSON.parse(saved) : { teamAScore: 0, teamBScore: 0, status: 'SCHEDULED' };
      const syntheticMatch: TournamentMatchUI = {
        id: normalMatchId,
        teamAScore: scores.teamAScore ?? 0,
        teamBScore: scores.teamBScore ?? 0,
        derivedStatus: scores.status ?? 'SCHEDULED',
        teamA: { id: 'a', name: 'Team A', emoji: '⚽', color: Colors.futsal, players: [] } as any,
        teamB: { id: 'b', name: 'Team B', emoji: '🏆', color: Colors.liveRed, players: [] } as any,
      } as any;
      setMatch(syntheticMatch);
      setIsOwner(true);
      setLoading(false);
      return;
    }
    if (!tournamentId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const [tournament, teamRecords, matchRecords] = await Promise.all([
        tournamentApi.getTournament(tournamentId),
        tournamentApi.listTeams(tournamentId),
        tournamentApi.listMatches(tournamentId),
      ]);
      const teams = teamRecords.map((t: any) => buildTeamUI(t, []));
      const teamMap = new Map(teams.map((t) => [t.id, t]));
      const overrides = await tournamentStorage.getMatchOverrides(tournamentId);
      const raw = matchRecords.find((m: any) => String(m.id) === String(matchId));
      if (raw) setMatch(buildMatchUI(raw, teamMap, overrides[String(matchId)]));
      setIsOwner(!!user && tournament.createdBy === user.firebaseUid);
    } catch (err) {
      console.warn('Failed to load match', err);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, matchId, normalMatchId, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isOwner || match?.derivedStatus !== 'LIVE') return;
    const interval = setInterval(() => load(true), 5000);
    return () => clearInterval(interval);
  }, [isOwner, match?.derivedStatus, load]);

  // Pulse animation for LIVE badge
  useEffect(() => {
    if (match?.derivedStatus !== 'LIVE') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [match?.derivedStatus]);

  // ─── Score helpers ────────────────────────────────────────────────────────

  const bumpScore = (which: 'A' | 'B') => {
    const anim = which === 'A' ? scoreAScale : scoreBScale;
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const persistOverride = async (next: { teamAScore?: number; teamBScore?: number; status?: any }) => {
    if (!match) return;
    if (normalMatchId) {
      await AsyncStorage.setItem(`normal_match_score_${normalMatchId}`, JSON.stringify(next)).catch(() => {});
      return;
    }
    await tournamentStorage.setMatchOverride(tournamentId, matchId, next);
    tournamentApi.updateScore(tournamentId, matchId, {
      teamAScore: next.teamAScore ?? match.teamAScore ?? 0,
      teamBScore: next.teamBScore ?? match.teamBScore ?? 0,
      status: next.status,
    }).catch(() => {});
  };

  const adjustScore = (which: 'A' | 'B', delta: number) => {
    if (!match) return;
    const currentA = match.teamAScore ?? 0;
    const currentB = match.teamBScore ?? 0;
    const nextA = which === 'A' ? Math.max(0, currentA + delta) : currentA;
    const nextB = which === 'B' ? Math.max(0, currentB + delta) : currentB;
    const status = match.derivedStatus === 'SCHEDULED' ? 'LIVE' : match.derivedStatus;
    setMatch({ ...match, teamAScore: nextA, teamBScore: nextB, derivedStatus: status });
    bumpScore(which);
    persistOverride({ teamAScore: nextA, teamBScore: nextB, status });
  };

  const handleStartMatch = () => {
    if (!match) return;
    setMatch({ ...match, derivedStatus: 'LIVE', teamAScore: 0, teamBScore: 0 });
    persistOverride({ teamAScore: 0, teamBScore: 0, status: 'LIVE' });
    if (sport === 'CRICKET') {
      setCricketInnings([{ battingTeam: 'A', runs: 0, wickets: 0, overs: 0, balls: 0, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 }, events: [] }]);
    }
  };

  const handleMarkFinal = () => {
    if (!match) return;
    setMatch({ ...match, derivedStatus: 'COMPLETED' });
    persistOverride({ teamAScore: match.teamAScore ?? 0, teamBScore: match.teamBScore ?? 0, status: 'COMPLETED' });
    setCelebrating(true);
    celebrateAnim.setValue(0);
    Animated.sequence([
      Animated.spring(celebrateAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(celebrateAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setCelebrating(false));
  };

  // ─── Futsal event ─────────────────────────────────────────────────────────

  const addFutsalEvent = () => {
    if (!match) return;
    const ev: FutsalEvent = { type: eventType, team: eventTeam, player: eventPlayer || 'Unknown', minute: matchMinute };
    setFutsalEvents((prev) => [ev, ...prev]);

    if (eventType === 'GOAL') {
      const currentA = match.teamAScore ?? 0;
      const currentB = match.teamBScore ?? 0;
      const nextA = eventTeam === 'A' ? currentA + 1 : currentA;
      const nextB = eventTeam === 'B' ? currentB + 1 : currentB;
      const status = match.derivedStatus === 'SCHEDULED' ? 'LIVE' : match.derivedStatus;
      setMatch({ ...match, teamAScore: nextA, teamBScore: nextB, derivedStatus: status });
      bumpScore(eventTeam);
      persistOverride({ teamAScore: nextA, teamBScore: nextB, status });

      // Update player stats
      setPlayerStats((prev) => {
        const existing = prev.find((p) => p.playerName === ev.player);
        if (existing) {
          return prev.map((p) => p.playerName === ev.player ? { ...p, goals: (p.goals || 0) + 1 } : p);
        }
        return [...prev, { playerId: ev.player, playerName: ev.player, goals: 1 }];
      });
    }

    setEventPlayer('');
    setEventModal(false);
  };

  // ─── Cricket ball ─────────────────────────────────────────────────────────

  const addCricketBall = (ballData: Partial<CricketBallEvent>) => {
    if (!match) return;
    const ball: CricketBallEvent = {
      runs: ballData.runs ?? 0,
      isWicket: ballData.isWicket ?? false,
      isWide: ballData.isWide ?? false,
      isNoBall: ballData.isNoBall ?? false,
      isBye: ballData.isBye ?? false,
      isLegBye: ballData.isLegBye ?? false,
      bowler: currentBowler || 'Unknown',
      batsman: currentBatsman || 'Unknown',
    };

    setCricketInnings((prev) => {
      const innings = [...prev];
      const current = { ...innings[currentInnings] };
      current.events = [ball, ...current.events];
      current.runs += ball.runs;
      if (ball.isWicket) current.wickets += 1;
      if (!ball.isWide && !ball.isNoBall) {
        current.balls += 1;
        if (current.balls >= 6) { current.overs += 1; current.balls = 0; }
      }
      if (ball.isWide) current.extras.wides += 1;
      if (ball.isNoBall) current.extras.noBalls += 1;
      innings[currentInnings] = current;

      // Update main scoreboard
      const totalA = innings.filter((i) => i.battingTeam === 'A').reduce((s, i) => s + i.runs, 0);
      const totalB = innings.filter((i) => i.battingTeam === 'B').reduce((s, i) => s + i.runs, 0);
      const status = match.derivedStatus === 'SCHEDULED' ? 'LIVE' : match.derivedStatus;
      setMatch((m) => m ? { ...m, teamAScore: totalA, teamBScore: totalB, derivedStatus: status } : m);
      persistOverride({ teamAScore: totalA, teamBScore: totalB, status });
      if (ball.runs > 0) bumpScore(current.battingTeam);

      return innings;
    });
    setCricketModal(false);
  };

  // ─── Pickleball rally ─────────────────────────────────────────────────────

  const addPickleballPoint = (team: 'A' | 'B') => {
    setPickleballGames((prev) => {
      const games = [...prev];
      const game = { ...games[currentGame] };
      if (team === 'A') game.scoreA += 1;
      else game.scoreB += 1;

      const winScore = 11;
      const wonA = game.scoreA >= winScore && game.scoreA - game.scoreB >= 2;
      const wonB = game.scoreB >= winScore && game.scoreB - game.scoreA >= 2;

      if (wonA) {
        game.winner = 'A';
        const newSets = setsA + 1;
        setSetsA(newSets);
        if (newSets < 2) {
          games.push({ scoreA: 0, scoreB: 0, winner: null });
          setCurrentGame(games.length - 1);
        }
        persistOverride({ teamAScore: newSets, teamBScore: setsB, status: newSets === 2 ? 'COMPLETED' : 'LIVE' });
        setMatch((m) => m ? { ...m, teamAScore: newSets, teamBScore: setsB, derivedStatus: newSets === 2 ? 'COMPLETED' : 'LIVE' } : m);
        bumpScore('A');
      } else if (wonB) {
        game.winner = 'B';
        const newSets = setsB + 1;
        setSetsB(newSets);
        if (newSets < 2) {
          games.push({ scoreA: 0, scoreB: 0, winner: null });
          setCurrentGame(games.length - 1);
        }
        persistOverride({ teamAScore: setsA, teamBScore: newSets, status: newSets === 2 ? 'COMPLETED' : 'LIVE' });
        setMatch((m) => m ? { ...m, teamAScore: setsA, teamBScore: newSets, derivedStatus: newSets === 2 ? 'COMPLETED' : 'LIVE' } : m);
        bumpScore('B');
      }

      games[currentGame] = game;
      return games;
    });
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const sportColor = SPORT_COLORS[sport];

  const renderStatusBadge = () => {
    const config = {
      SCHEDULED: { label: 'Not Started', color: Colors.neutral500, bg: Colors.neutral200 },
      LIVE: { label: 'LIVE', color: Colors.liveRed, bg: Colors.liveRed + '18' },
      COMPLETED: { label: 'Full Time', color: Colors.success, bg: Colors.success + '18' },
    }[match?.derivedStatus || 'SCHEDULED'];

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
        {match?.derivedStatus === 'LIVE' && (
          <Animated.View style={[styles.liveDot, { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]} />
        )}
        <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  };

  const renderScoreboard = () => {
    if (sport === 'CRICKET') return renderCricketScoreboard();
    if (sport === 'PICKLEBALL') return renderPickleballScoreboard();
    return renderFutsalScoreboard();
  };

  const renderFutsalScoreboard = () => (
    <LinearGradient colors={['#1A2744', '#0F172A']} style={styles.scoreboard}>
      <View style={styles.teamColumn}>
        <Text style={styles.teamEmoji}>{match?.teamA?.emoji || '⚽'}</Text>
        <Text style={styles.teamName}>{match?.teamA?.name || 'Team A'}</Text>
        <Animated.Text style={[styles.scoreText, { transform: [{ scale: scoreAScale }] }]}>
          {match?.teamAScore ?? 0}
        </Animated.Text>
        {isOwner && match?.derivedStatus !== 'COMPLETED' && (
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepperMinus} onPress={() => adjustScore('A', -1)}>
              <Minus color={Colors.white} size={16} strokeWidth={3} />
            </Pressable>
            <Pressable style={[styles.stepperPlus, { backgroundColor: sportColor }]} onPress={() => adjustScore('A', 1)}>
              <Plus color={Colors.white} size={16} strokeWidth={3} />
            </Pressable>
          </View>
        )}
      </View>
      <View style={styles.vsDivider}>
        <Text style={styles.vsLabel}>VS</Text>
        {match?.derivedStatus === 'LIVE' && (
          <View style={styles.liveIndicator}>
            <Radio color={Colors.liveRed} size={12} strokeWidth={2} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>
      <View style={styles.teamColumn}>
        <Text style={styles.teamEmoji}>{match?.teamB?.emoji || '🏆'}</Text>
        <Text style={styles.teamName}>{match?.teamB?.name || 'Team B'}</Text>
        <Animated.Text style={[styles.scoreText, { transform: [{ scale: scoreBScale }] }]}>
          {match?.teamBScore ?? 0}
        </Animated.Text>
        {isOwner && match?.derivedStatus !== 'COMPLETED' && (
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepperMinus} onPress={() => adjustScore('B', -1)}>
              <Minus color={Colors.white} size={16} strokeWidth={3} />
            </Pressable>
            <Pressable style={[styles.stepperPlus, { backgroundColor: sportColor }]} onPress={() => adjustScore('B', 1)}>
              <Plus color={Colors.white} size={16} strokeWidth={3} />
            </Pressable>
          </View>
        )}
      </View>
    </LinearGradient>
  );

  const renderCricketScoreboard = () => {
    const innings = cricketInnings[currentInnings];
    return (
      <LinearGradient colors={['#1A2744', '#0F172A']} style={styles.cricketBoard}>
        <View style={styles.cricketHeader}>
          <Text style={styles.cricketInningsLabel}>INNINGS {currentInnings + 1}</Text>
          {innings && (
            <Text style={styles.cricketOvers}>{innings.overs}.{innings.balls} / {totalOvers} overs</Text>
          )}
        </View>

        {innings && (
          <>
            <View style={styles.cricketScoreRow}>
              <Text style={styles.cricketRunsText}>{innings.runs}</Text>
              <Text style={styles.cricketWicketsText}>/{innings.wickets}</Text>
            </View>
            <Text style={styles.cricketBattingLabel}>
              {innings.battingTeam === 'A' ? match?.teamA?.name : match?.teamB?.name} batting
            </Text>
            <View style={styles.cricketExtrasRow}>
              <Text style={styles.cricketExtrasLabel}>Extras: {innings.extras.wides}w {innings.extras.noBalls}nb {innings.extras.byes}b {innings.extras.legByes}lb</Text>
            </View>

            <View style={styles.cricketTeamsRow}>
              <View style={styles.cricketTeamSummary}>
                <Text style={styles.cricketTeamName}>{match?.teamA?.emoji} {match?.teamA?.name}</Text>
                <Text style={styles.cricketTeamScore}>{match?.teamAScore ?? 0}</Text>
              </View>
              <Text style={styles.vsLabel}>VS</Text>
              <View style={styles.cricketTeamSummary}>
                <Text style={styles.cricketTeamName}>{match?.teamB?.emoji} {match?.teamB?.name}</Text>
                <Text style={styles.cricketTeamScore}>{match?.teamBScore ?? 0}</Text>
              </View>
            </View>
          </>
        )}
      </LinearGradient>
    );
  };

  const renderPickleballScoreboard = () => {
    const game = pickleballGames[currentGame];
    return (
      <LinearGradient colors={['#1A2744', '#0F172A']} style={styles.scoreboard}>
        <View style={styles.teamColumn}>
          <Text style={styles.teamEmoji}>{match?.teamA?.emoji || '🏓'}</Text>
          <Text style={styles.teamName}>{match?.teamA?.name || 'Team A'}</Text>
          <Text style={styles.setsLabel}>{setsA} sets</Text>
          <Animated.Text style={[styles.scoreText, { transform: [{ scale: scoreAScale }] }]}>
            {game?.scoreA ?? 0}
          </Animated.Text>
          {isOwner && match?.derivedStatus !== 'COMPLETED' && game?.winner === null && (
            <Pressable style={[styles.rallyBtn, { backgroundColor: sportColor }]} onPress={() => addPickleballPoint('A')}>
              <Plus color={Colors.white} size={18} strokeWidth={2.5} />
              <Text style={styles.rallyBtnText}>Rally</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.vsDivider}>
          <Text style={styles.vsLabel}>GAME {currentGame + 1}</Text>
          <Text style={styles.pickleballSetLabel}>Best of 3</Text>
        </View>
        <View style={styles.teamColumn}>
          <Text style={styles.teamEmoji}>{match?.teamB?.emoji || '🏆'}</Text>
          <Text style={styles.teamName}>{match?.teamB?.name || 'Team B'}</Text>
          <Text style={styles.setsLabel}>{setsB} sets</Text>
          <Animated.Text style={[styles.scoreText, { transform: [{ scale: scoreBScale }] }]}>
            {game?.scoreB ?? 0}
          </Animated.Text>
          {isOwner && match?.derivedStatus !== 'COMPLETED' && game?.winner === null && (
            <Pressable style={[styles.rallyBtn, { backgroundColor: sportColor }]} onPress={() => addPickleballPoint('B')}>
              <Plus color={Colors.white} size={18} strokeWidth={2.5} />
              <Text style={styles.rallyBtnText}>Rally</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>
    );
  };

  const renderEventsTab = () => {
    if (sport === 'CRICKET') return renderCricketEvents();
    if (sport === 'PICKLEBALL') return renderPickleballSets();
    return renderFutsalEvents();
  };

  const renderFutsalEvents = () => (
    <View style={styles.eventsSection}>
      <View style={styles.minuteRow}>
        <Text style={styles.eventsTitle}>Match Events</Text>
        <View style={styles.minuteControl}>
          <Pressable onPress={() => setMatchMinute((m) => Math.max(0, m - 1))} style={styles.minuteBtn}>
            <Minus color={Colors.primary} size={14} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.minuteText}>{matchMinute}'</Text>
          <Pressable onPress={() => setMatchMinute((m) => m + 1)} style={styles.minuteBtn}>
            <Plus color={Colors.primary} size={14} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      {isOwner && match?.derivedStatus === 'LIVE' && (
        <Pressable style={[styles.addEventBtn, { backgroundColor: sportColor }]} onPress={() => setEventModal(true)}>
          <Plus color={Colors.white} size={16} strokeWidth={2.5} />
          <Text style={styles.addEventBtnText}>Add Event</Text>
        </Pressable>
      )}

      {futsalEvents.length === 0 ? (
        <View style={styles.emptyEvents}>
          <Text style={styles.emptyEventsEmoji}>⚽</Text>
          <Text style={styles.emptyEventsText}>No events yet. Start scoring!</Text>
        </View>
      ) : (
        futsalEvents.map((ev, i) => (
          <View key={i} style={[styles.eventRow, { borderLeftColor: ev.team === 'A' ? (match?.teamA as any)?.color || Colors.primary : Colors.liveRed }]}>
            <View style={styles.eventBadge}>
              <Text style={styles.eventBadgeText}>{ev.minute}'</Text>
            </View>
            <View style={styles.eventIcon}>
              <Text style={styles.eventIconText}>
                {ev.type === 'GOAL' ? '⚽' : ev.type === 'ASSIST' ? '🎯' : ev.type === 'YELLOW' ? '🟨' : ev.type === 'RED' ? '🟥' : '🧤'}
              </Text>
            </View>
            <View style={styles.eventInfo}>
              <Text style={styles.eventType}>{ev.type}</Text>
              <Text style={styles.eventPlayer}>{ev.player} • {ev.team === 'A' ? match?.teamA?.name : match?.teamB?.name}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const renderCricketEvents = () => {
    const innings = cricketInnings[currentInnings];
    return (
      <View style={styles.eventsSection}>
        <Text style={styles.eventsTitle}>Ball-by-Ball</Text>
        {isOwner && match?.derivedStatus === 'LIVE' && (
          <Pressable style={[styles.addEventBtn, { backgroundColor: Colors.cricket }]} onPress={() => setCricketModal(true)}>
            <Target color={Colors.white} size={16} strokeWidth={2.5} />
            <Text style={styles.addEventBtnText}>Record Ball</Text>
          </Pressable>
        )}
        {innings?.events.length === 0 || !innings ? (
          <View style={styles.emptyEvents}>
            <Text style={styles.emptyEventsEmoji}>🏏</Text>
            <Text style={styles.emptyEventsText}>No balls recorded yet.</Text>
          </View>
        ) : (
          innings.events.map((ball, i) => (
            <View key={i} style={[styles.eventRow, { borderLeftColor: Colors.cricket }]}>
              <View style={styles.eventBadge}>
                <Text style={styles.eventBadgeText}>{ball.isWide ? 'W' : ball.isNoBall ? 'NB' : `${innings.overs - Math.floor(i / 6)}.${5 - (i % 6)}`}</Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventType}>{ball.isWicket ? '🔴 WICKET' : ball.runs === 4 ? '🔵 FOUR' : ball.runs === 6 ? '🟡 SIX' : ball.isWide ? '⚪ WIDE' : ball.isNoBall ? '🟠 NO BALL' : `${ball.runs} runs`}</Text>
                <Text style={styles.eventPlayer}>{ball.batsman} • off {ball.bowler}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  const renderPickleballSets = () => (
    <View style={styles.eventsSection}>
      <Text style={styles.eventsTitle}>Game History</Text>
      {pickleballGames.map((game, i) => (
        <View key={i} style={[styles.pickleballGameRow, i === currentGame && styles.pickleballGameRowActive]}>
          <Text style={styles.pickleballGameLabel}>Game {i + 1}</Text>
          <View style={styles.pickleballGameScores}>
            <Text style={[styles.pickleballScore, game.winner === 'A' && styles.pickleballScoreWinner]}>{game.scoreA}</Text>
            <Text style={styles.pickleballScoreDash}>-</Text>
            <Text style={[styles.pickleballScore, game.winner === 'B' && styles.pickleballScoreWinner]}>{game.scoreB}</Text>
          </View>
          {game.winner && (
            <View style={styles.pickleballWinner}>
              <Award color={Colors.warning} size={14} strokeWidth={2.5} />
              <Text style={styles.pickleballWinnerText}>{game.winner === 'A' ? match?.teamA?.name : match?.teamB?.name}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderStatsTab = () => (
    <View style={styles.eventsSection}>
      <Text style={styles.eventsTitle}>Player Statistics</Text>
      {playerStats.length === 0 ? (
        <View style={styles.emptyEvents}>
          <Text style={styles.emptyEventsEmoji}>📊</Text>
          <Text style={styles.emptyEventsText}>No stats recorded yet. Events will generate stats automatically.</Text>
        </View>
      ) : (
        <>
          {/* Team A stats */}
          <View style={styles.statsTeamHeader}>
            <Text style={styles.statsTeamName}>{match?.teamA?.emoji} {match?.teamA?.name}</Text>
          </View>
          {playerStats.filter((p) => futsalEvents.some((e) => e.player === p.playerName && e.team === 'A')).map((stat, i) => (
            <View key={i} style={styles.playerStatRow}>
              <View style={styles.playerStatAvatar}>
                <Text style={styles.playerStatAvatarText}>{stat.playerName.charAt(0)}</Text>
              </View>
              <Text style={styles.playerStatName}>{stat.playerName}</Text>
              <View style={styles.playerStatBadges}>
                {(stat.goals ?? 0) > 0 && <View style={styles.statBadge}><Text style={styles.statBadgeText}>⚽ {stat.goals}</Text></View>}
                {(stat.assists ?? 0) > 0 && <View style={styles.statBadge}><Text style={styles.statBadgeText}>🎯 {stat.assists}</Text></View>}
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );

  // ─── Sport selector tabs ──────────────────────────────────────────────────

  const renderSportSelector = () => (
    isOwner && match?.derivedStatus === 'SCHEDULED' ? (
      <View style={styles.sportSelectorRow}>
        {(['FUTSAL', 'CRICKET', 'PICKLEBALL'] as Sport[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSport(s)}
            style={[styles.sportSelectorChip, sport === s && { backgroundColor: SPORT_COLORS[s], borderColor: SPORT_COLORS[s] }]}
          >
            <Text style={styles.sportSelectorEmoji}>
              {s === 'FUTSAL' ? '⚽' : s === 'CRICKET' ? '🏏' : '🏓'}
            </Text>
            <Text style={[styles.sportSelectorText, sport === s && { color: Colors.white }]}>{s}</Text>
          </Pressable>
        ))}
      </View>
    ) : null
  );

  // ─── Main render ──────────────────────────────────────────────────────────

  if (loading || !match) {
    return (
      <SafeAreaView style={styles.loadingScreen} edges={['top']}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading match...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SubscriptionGate feature="match scoring">
    <SafeAreaView style={styles.flex1} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={[sportColor, sportColor + 'CC']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={22} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {sport === 'CRICKET' ? '🏏' : sport === 'PICKLEBALL' ? '🏓' : '⚽'} {sport} Match
          </Text>
          {renderStatusBadge()}
        </View>
        <View style={{ width: 36 }} />
      </LinearGradient>

      <ScrollView style={styles.flex1} showsVerticalScrollIndicator={false}>
        {/* Sport selector (only pre-match for owner) */}
        {renderSportSelector()}

        {/* Scoreboard */}
        <View style={styles.scoreboardWrapper}>
          {renderScoreboard()}
        </View>

        {/* Owner controls */}
        {!isOwner && (
          <View style={styles.viewerCard}>
            <Radio color={Colors.primary} size={16} strokeWidth={2} />
            <Text style={styles.viewerText}>Following live • Score updates every 5s</Text>
          </View>
        )}

        {isOwner && match.derivedStatus === 'SCHEDULED' && (
          <Pressable style={[styles.actionButton, { backgroundColor: Colors.success }]} onPress={handleStartMatch}>
            <Play color={Colors.white} size={18} strokeWidth={2.5} />
            <Text style={styles.actionButtonText}>Start Match</Text>
          </Pressable>
        )}

        {isOwner && match.derivedStatus === 'LIVE' && (
          <View style={styles.ownerActionsRow}>
            {sport === 'FUTSAL' && (
              <Pressable style={[styles.actionButtonSmall, { backgroundColor: sportColor }]} onPress={() => setEventModal(true)}>
                <Target color={Colors.white} size={16} strokeWidth={2.5} />
                <Text style={styles.actionButtonSmallText}>Log Goal</Text>
              </Pressable>
            )}
            {sport === 'CRICKET' && (
              <Pressable style={[styles.actionButtonSmall, { backgroundColor: Colors.cricket }]} onPress={() => setCricketModal(true)}>
                <Target color={Colors.white} size={16} strokeWidth={2.5} />
                <Text style={styles.actionButtonSmallText}>Record Ball</Text>
              </Pressable>
            )}
            <Pressable style={[styles.actionButtonSmall, { backgroundColor: Colors.liveRed }]} onPress={handleMarkFinal}>
              <Flag color={Colors.white} size={16} strokeWidth={2.5} />
              <Text style={styles.actionButtonSmallText}>Full Time</Text>
            </Pressable>
          </View>
        )}

        {match.derivedStatus === 'COMPLETED' && (
          <View style={styles.completedBanner}>
            <Award color={Colors.warning} size={24} strokeWidth={2} />
            <Text style={styles.completedTitle}>Match Complete!</Text>
            <Text style={styles.completedSub}>
              {(match.teamAScore ?? 0) > (match.teamBScore ?? 0)
                ? `${match.teamA?.name} wins!`
                : (match.teamBScore ?? 0) > (match.teamAScore ?? 0)
                ? `${match.teamB?.name} wins!`
                : 'It\'s a draw!'}
            </Text>
          </View>
        )}

        {/* Tab navigation */}
        <View style={styles.tabBar}>
          {(['SCORE', 'EVENTS', 'STATS'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabItem, activeTab === tab && { borderBottomColor: sportColor }]}
            >
              <Text style={[styles.tabText, activeTab === tab && { color: sportColor }]}>{tab}</Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {activeTab === 'SCORE' && renderScoreboard()}
          {activeTab === 'EVENTS' && renderEventsTab()}
          {activeTab === 'STATS' && renderStatsTab()}
        </View>
      </ScrollView>

      {/* Celebration overlay */}
      {celebrating && (
        <Animated.View
          style={[styles.celebrateOverlay, { opacity: celebrateAnim, transform: [{ scale: celebrateAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}
          pointerEvents="none"
        >
          <PartyPopper color={Colors.warning} size={64} strokeWidth={2} />
          <Text style={styles.celebrateText}>Full Time! 🎉</Text>
          <Text style={styles.celebrateSub}>
            {(match.teamAScore ?? 0) !== (match.teamBScore ?? 0)
              ? `Winner: ${(match.teamAScore ?? 0) > (match.teamBScore ?? 0) ? match.teamA?.name : match.teamB?.name}`
              : "It's a Draw!"}
          </Text>
        </Animated.View>
      )}

      {/* Futsal event modal */}
      <Modal visible={eventModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Match Event</Text>
              <Pressable onPress={() => setEventModal(false)}>
                <X color={Colors.text} size={20} strokeWidth={2.5} />
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>Event Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {(['GOAL', 'ASSIST', 'YELLOW', 'RED', 'SAVE'] as FutsalEvent['type'][]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setEventType(t)}
                  style={[styles.eventTypeChip, eventType === t && { backgroundColor: sportColor }]}
                >
                  <Text style={styles.eventTypeEmoji}>
                    {t === 'GOAL' ? '⚽' : t === 'ASSIST' ? '🎯' : t === 'YELLOW' ? '🟨' : t === 'RED' ? '🟥' : '🧤'}
                  </Text>
                  <Text style={[styles.eventTypeText, eventType === t && { color: Colors.white }]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.modalLabel}>Team</Text>
            <View style={styles.teamSelectRow}>
              {(['A', 'B'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setEventTeam(t)}
                  style={[styles.teamSelectBtn, eventTeam === t && { backgroundColor: sportColor }]}
                >
                  <Text style={[styles.teamSelectText, eventTeam === t && { color: Colors.white }]}>
                    {t === 'A' ? (match.teamA?.name || 'Team A') : (match.teamB?.name || 'Team B')}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalLabel}>Player Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter player name..."
              placeholderTextColor={Colors.neutral400}
              value={eventPlayer}
              onChangeText={setEventPlayer}
            />

            <Pressable style={[styles.modalSubmitBtn, { backgroundColor: sportColor }]} onPress={addFutsalEvent}>
              <Text style={styles.modalSubmitText}>Log Event</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Cricket ball modal */}
      <Modal visible={cricketModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Ball</Text>
              <Pressable onPress={() => setCricketModal(false)}>
                <X color={Colors.text} size={20} strokeWidth={2.5} />
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>Runs scored</Text>
            <View style={styles.runsRow}>
              {[0, 1, 2, 3, 4, 6].map((r) => (
                <Pressable key={r} style={[styles.runBtn, { backgroundColor: Colors.cricket }]} onPress={() => addCricketBall({ runs: r })}>
                  <Text style={styles.runBtnText}>{r}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.cricketSpecialRow}>
              <Pressable style={[styles.specialBtn, { backgroundColor: Colors.liveRed }]} onPress={() => addCricketBall({ isWicket: true })}>
                <Text style={styles.specialBtnText}>🔴 WICKET</Text>
              </Pressable>
              <Pressable style={[styles.specialBtn, { backgroundColor: Colors.neutral600 }]} onPress={() => addCricketBall({ isWide: true, runs: 1 })}>
                <Text style={styles.specialBtnText}>⚪ WIDE</Text>
              </Pressable>
              <Pressable style={[styles.specialBtn, { backgroundColor: Colors.warning }]} onPress={() => addCricketBall({ isNoBall: true, runs: 1 })}>
                <Text style={styles.specialBtnText}>🟠 NO BALL</Text>
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>Batsman</Text>
            <TextInput style={styles.modalInput} placeholder="Batsman name..." placeholderTextColor={Colors.neutral400} value={currentBatsman} onChangeText={setCurrentBatsman} />
            <Text style={styles.modalLabel}>Bowler</Text>
            <TextInput style={styles.modalInput} placeholder="Bowler name..." placeholderTextColor={Colors.neutral400} value={currentBowler} onChangeText={setCurrentBowler} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </SubscriptionGate>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: Colors.background },
  loadingScreen: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: Colors.textSecondary },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.white },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.liveRed },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  sportSelectorRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  sportSelectorChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.neutral200, flex: 1, justifyContent: 'center',
  },
  sportSelectorEmoji: { fontSize: 14 },
  sportSelectorText: { fontSize: 11, fontWeight: '700', color: Colors.text },

  scoreboardWrapper: { margin: 16 },

  scoreboard: { borderRadius: 24, paddingVertical: 28, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamColumn: { flex: 1, alignItems: 'center', gap: 6 },
  teamEmoji: { fontSize: 32 },
  teamName: { fontSize: 13, fontWeight: '700', color: Colors.white, textAlign: 'center' },
  scoreText: { fontSize: 52, fontWeight: '900', color: Colors.white, marginVertical: 4 },
  setsLabel: { fontSize: 11, color: Colors.white + '80', fontWeight: '600' },
  stepperRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  stepperMinus: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  stepperPlus: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  vsDivider: { alignItems: 'center', gap: 8 },
  vsLabel: { fontSize: 14, fontWeight: '900', color: 'rgba(255,255,255,0.4)' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveText: { fontSize: 10, fontWeight: '800', color: Colors.liveRed },

  rallyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, marginTop: 4 },
  rallyBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  // Cricket scoreboard
  cricketBoard: { borderRadius: 24, padding: 20 },
  cricketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cricketInningsLabel: { fontSize: 11, fontWeight: '800', color: Colors.white + '80', letterSpacing: 0.5 },
  cricketOvers: { fontSize: 12, color: Colors.white + '80', fontWeight: '600' },
  cricketScoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  cricketRunsText: { fontSize: 56, fontWeight: '900', color: Colors.white },
  cricketWicketsText: { fontSize: 32, fontWeight: '700', color: Colors.white + 'AA', marginBottom: 6, marginLeft: 4 },
  cricketBattingLabel: { fontSize: 13, color: Colors.white + 'CC', marginBottom: 8 },
  cricketExtrasRow: {},
  cricketExtrasLabel: { fontSize: 11, color: Colors.white + '70' },
  cricketTeamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  cricketTeamSummary: { alignItems: 'center', gap: 4 },
  cricketTeamName: { fontSize: 12, color: Colors.white + 'CC', fontWeight: '600' },
  cricketTeamScore: { fontSize: 22, fontWeight: '800', color: Colors.white },

  // Pickleball
  pickleballSetLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },

  // Viewer/owner cards
  viewerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryLight, marginHorizontal: 16, borderRadius: 12,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.primary + '30',
  },
  viewerText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },

  actionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 16, paddingVertical: 15, marginHorizontal: 16, marginBottom: 12,
  },
  actionButtonText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  ownerActionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  actionButtonSmall: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 14, paddingVertical: 12,
  },
  actionButtonSmallText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  completedBanner: {
    alignItems: 'center', backgroundColor: Colors.success + '15',
    marginHorizontal: 16, borderRadius: 16, padding: 20, gap: 6, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.success + '40',
  },
  completedTitle: { fontSize: 20, fontWeight: '900', color: Colors.text },
  completedSub: { fontSize: 14, color: Colors.textSecondary },

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: Colors.white, marginHorizontal: 16, borderRadius: 14, padding: 4, marginBottom: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 12, fontWeight: '700', color: Colors.neutral400 },
  tabContent: { paddingBottom: 40 },

  // Events section
  eventsSection: { paddingHorizontal: 16, paddingTop: 8 },
  eventsTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  minuteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  minuteControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  minuteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  minuteText: { fontSize: 14, fontWeight: '700', color: Colors.primary, minWidth: 32, textAlign: 'center' },
  addEventBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 11, marginBottom: 12 },
  addEventBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  emptyEvents: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyEventsEmoji: { fontSize: 40 },
  emptyEventsText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 3 },
  eventBadge: { backgroundColor: Colors.neutral100, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  eventBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.text },
  eventIcon: {},
  eventIconText: { fontSize: 18 },
  eventInfo: { flex: 1 },
  eventType: { fontSize: 13, fontWeight: '700', color: Colors.text },
  eventPlayer: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  // Cricket events
  runsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  runBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  runBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  cricketSpecialRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  specialBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  specialBtnText: { fontSize: 11, fontWeight: '700', color: Colors.white },

  // Pickleball game history
  pickleballGameRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.neutral200 },
  pickleballGameRowActive: { borderColor: Colors.pickleball, borderWidth: 2 },
  pickleballGameLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, flex: 1 },
  pickleballGameScores: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickleballScore: { fontSize: 18, fontWeight: '800', color: Colors.text },
  pickleballScoreWinner: { color: Colors.success },
  pickleballScoreDash: { fontSize: 14, color: Colors.textMuted },
  pickleballWinner: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 12 },
  pickleballWinnerText: { fontSize: 11, fontWeight: '600', color: Colors.warning },

  // Stats tab
  statsTeamHeader: { backgroundColor: Colors.primaryLight, borderRadius: 10, padding: 10, marginBottom: 8 },
  statsTeamName: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  playerStatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8 },
  playerStatAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  playerStatAvatarText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  playerStatName: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  playerStatBadges: { flexDirection: 'row', gap: 6 },
  statBadge: { backgroundColor: Colors.neutral100, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.text },

  // Futsal modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  modalLabel: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 8, marginTop: 12 },
  eventTypeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: Colors.neutral100, borderWidth: 1, borderColor: Colors.neutral200, marginRight: 8 },
  eventTypeEmoji: { fontSize: 14 },
  eventTypeText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  teamSelectRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  teamSelectBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.neutral100, alignItems: 'center', borderWidth: 1, borderColor: Colors.neutral200 },
  teamSelectText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  modalInput: { backgroundColor: Colors.neutral100, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text, marginBottom: 4 },
  modalSubmitBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  modalSubmitText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  celebrateOverlay: { position: 'absolute', top: '35%', left: 0, right: 0, alignItems: 'center', gap: 12 },
  celebrateText: { fontSize: 24, fontWeight: '900', color: Colors.warning },
  celebrateSub: { fontSize: 16, fontWeight: '700', color: Colors.text },
});
