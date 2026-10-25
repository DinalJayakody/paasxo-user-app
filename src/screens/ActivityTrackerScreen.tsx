import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ScrollView,
  Share,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import {
  ArrowLeft, Play, Pause, Square, CheckCircle,
  Navigation, Zap, TrendingUp, Wind,
  ChevronRight, Trophy, Share2, Trash2, MapPin,
  Footprints, ListOrdered, BookImage, Send,
  Globe, Users, Lock, Camera, Image as ImageIcon,
} from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { activityStorage, activityApi, StoredActivity, ActivityType, ActivityVisibility, activityShareUrl } from '../api/activityApi';
import { goBack } from '../utils/navigation';
import { useActivityTracking } from '../hooks/useActivityTracking';
import { useActivityShareCard } from '../hooks/useActivityShareCard';
import { SHARE_CARD_TEMPLATES } from '../components/activity/ActivityShareCard';
import { PersistedTrackingSession, loadTrackingSession, clearTrackingSession } from '../lib/activeTrackingSession';
import { subscribeActivityControl, consumePendingActivityControl } from '../lib/activityControlBus';
import { storyApi } from '../api/storyApi';
import { socialMediaApi } from '../api/socialMediaApi';
import { extractApiError } from '../utils/apiError';
import {
  LiveSplit, formatTime, formatDist, distUnit, formatPace, genLocalId,
  bestSplitPaceSecPerKm, bestSplitSpeedKmh, fastest400mSeconds, calcCalories, MetActivityType,
} from '../utils/activityMath';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = 'SELECT' | 'COUNTDOWN' | 'ACTIVE' | 'PAUSED' | 'SUMMARY';
type GpsStatus = 'CHECKING' | 'READY' | 'ERROR';

// ── Activity configs ───────────────────────────────────────────────────────────
// Pace (min/km) is the only speed-like metric shown anywhere in the activity
// UI — km/h is never displayed, for any activity type, including CYCLING.
// avgSpeedKmh/maxSpeedKmh are still computed/stored (the calorie MET lookup
// needs them), just never rendered.
const ACT = {
  WALK: {
    label: 'Walk',
    emoji: '🚶',
    icon: 'walk',
    colors: ['#059669', '#047857'] as [string, string],
    accentColor: '#059669',
    guideText: 'Perfect for a relaxed outdoor stroll. Every step counts!',
  },
  RUN: {
    label: 'Run',
    emoji: '🏃',
    icon: 'run-fast',
    colors: ['#DC2626', '#991B1B'] as [string, string],
    accentColor: '#DC2626',
    guideText: 'Push your limits. Stay hydrated and breathe steady!',
  },
  CYCLING: {
    label: 'Cycle',
    emoji: '🚴',
    icon: 'bike',
    colors: ['#2563EB', '#1D4ED8'] as [string, string],
    accentColor: '#2563EB',
    guideText: 'Cover more ground on two wheels. Enjoy the ride!',
  },
} as const;

function autoTitle(type: ActivityType): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  return `${part} ${ACT[type].label}`;
}

// ── Animated background orbs ──────────────────────────────────────────────────
const Orb = ({ color, size, top, left, delay }: { color: string; size: number; top: number; left: number; delay: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 3500, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 3500, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top, left,
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
      }}
    />
  );
};

// ── Bouncing avatar ───────────────────────────────────────────────────────────
const Avatar = ({ type, active }: { type: ActivityType; active: boolean }) => {
  const bounce = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (active) {
      const speed = type === 'RUN' ? 250 : type === 'CYCLING' ? 300 : 500;
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounce, { toValue: -10, duration: speed, useNativeDriver: true }),
          Animated.timing(bounce, { toValue: 0, duration: speed, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(tilt, { toValue: -0.1, duration: speed, useNativeDriver: true }),
          Animated.timing(tilt, { toValue: 0.1, duration: speed * 2, useNativeDriver: true }),
          Animated.timing(tilt, { toValue: -0.1, duration: speed, useNativeDriver: true }),
        ])
      ).start();
    } else {
      bounce.stopAnimation();
      tilt.stopAnimation();
      Animated.parallel([
        Animated.spring(bounce, { toValue: 0, useNativeDriver: true, damping: 10 }),
        Animated.spring(tilt, { toValue: 0, useNativeDriver: true, damping: 10 }),
      ]).start();
    }
  }, [active, type]);
  return (
    <Animated.View style={{ transform: [{ translateY: bounce }, { rotate: tilt.interpolate({ inputRange: [-0.15, 0.15], outputRange: ['-8deg', '8deg'] }) }] }}>
      <MaterialCommunityIcons name={ACT[type].icon} size={64} color={Colors.white} />
    </Animated.View>
  );
};

// ── Big round start button with a breathing ring ──────────────────────────────
const StartRing = ({ colors, ready, label, onPress }: {
  colors: [string, string]; ready: boolean; label: string; onPress: () => void;
}) => {
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) { ring.stopAnimation(); ring.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1800, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [ready, ring]);
  return (
    <View style={styles.startRingWrap}>
      {ready && (
        <Animated.View
          pointerEvents="none"
          style={[styles.startRingPulse, {
            borderColor: colors[0],
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
          }]}
        />
      )}
      <TouchableOpacity
        onPress={onPress}
        disabled={!ready}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={ready ? `Start ${label}` : 'Waiting for GPS'}
      >
        <LinearGradient
          colors={ready ? colors : ['#334155', '#1E293B']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.startRing}
        >
          <Play color={Colors.white} size={34} strokeWidth={2.5} fill={Colors.white} style={{ marginLeft: 4 }} />
          <Text style={styles.startRingText}>{ready ? 'START' : 'GPS…'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// ── Pulsing GPS dot ───────────────────────────────────────────────────────────
const GpsDot = ({ color }: { color: string }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
      <Animated.View style={{ position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: color, opacity: 0.25, transform: [{ scale: pulse }] }} />
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
    </View>
  );
};

// ── Countdown display ─────────────────────────────────────────────────────────
// `starting` covers the gap after "1" while tracking.start() is still
// in-flight (permission checks, registering the background location task) —
// without a distinct visual here, the screen just freezes on "1" with no
// indication anything is still happening, which reads as the app hanging.
const Countdown = ({ value, color, starting }: { value: number; color: string; starting: boolean }) => {
  const scale = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    scale.setValue(0.5);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 180, friction: 7 }).start();
  }, [value, starting]);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      {starting ? (
        <ActivityIndicator size="large" color={color} style={{ transform: [{ scale: 1.4 }] }} />
      ) : (
        <Animated.Text style={{ fontSize: 100, fontWeight: '900', color, transform: [{ scale }] }}>
          {value}
        </Animated.Text>
      )}
      <Text style={{ fontSize: 20, color: Colors.neutral500, fontWeight: '600', marginTop: starting ? 16 : -8 }}>
        {starting ? 'Starting…' : 'Get ready!'}
      </Text>
    </View>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────
/** Copies the photo picked for the "photo" share design into the app's
 *  documents folder, so the saved activity can show it again later (picker
 *  results live in a cache folder the OS may clear). Best effort. */
async function persistActivityPhoto(uri: string, localId: string): Promise<string | undefined> {
  try {
    const FileSystem = require('expo-file-system/legacy');
    if (!FileSystem.documentDirectory) return uri;
    const dir = `${FileSystem.documentDirectory}activity-photos/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const safeId = localId.replace(/[^A-Za-z0-9_-]/g, '');
    const dest = `${dir}${safeId}.jpg`;
    if (uri !== dest) {
      await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
      await FileSystem.copyAsync({ from: uri, to: dest });
    }
    return dest;
  } catch {
    return uri;
  }
}

export default function ActivityTrackerScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { user } = useAuth();

  // Phase state
  const [phase, setPhase] = useState<Phase>('SELECT');
  // Pre-selected when launched from a Walk/Run/Cycle shortcut (?type=WALK).
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const [actType, setActType] = useState<ActivityType>(
    typeParam === 'WALK' || typeParam === 'CYCLING' || typeParam === 'RUN' ? typeParam : 'RUN'
  );
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('CHECKING');
  const [countdown, setCountdown] = useState(3);
  // True for the gap between the "1" tick finishing and tracking.start()
  // actually resolving (permission handshake, registering the location
  // task, etc.) — without this the countdown screen just freezes on "1"
  // for however long that takes, which reads as the app hanging even when
  // it's still working. See renderCountdownPhase/Countdown below.
  const [starting, setStarting] = useState(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentLoc, setCurrentLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completedActivity, setCompletedActivity] = useState<StoredActivity | null>(null);
  // Personal-best messages set by finishActivity when the just-finished
  // activity beat every prior one of the same type — shown on the summary
  // screen, see renderSummaryPhase.
  const [newRecords, setNewRecords] = useState<string[]>([]);
  // Set once the completed activity has been synced to the backend (by
  // "Save Activity" or implicitly by any share action) — a real serverId is
  // what a share link actually points at. See ensureSavedAndSynced.
  const [savedServerId, setSavedServerId] = useState<string | null>(null);
  const syncPromiseRef = useRef<Promise<string | null> | null>(null);
  // Filled in below once the share-card hook exists: stamps the currently
  // picked design (and a persisted copy of its photo) onto the activity.
  const withShareDesignRef = useRef<(a: StoredActivity) => Promise<StoredActivity>>(async (a) => a);
  const [shareBusy, setShareBusy] = useState<null | 'story' | 'post' | 'external'>(null);
  // A checkpoint found on mount from a session that never got a normal
  // finish — the app was killed (or crashed) while ACTIVE/PAUSED. Non-null
  // shows the resume-or-discard prompt instead of the usual SELECT screen;
  // see checkForResumableSession below and activeTrackingSession.ts.
  const [resumableSession, setResumableSession] = useState<PersistedTrackingSession | null>(null);
  const [resuming, setResuming] = useState(false);

  // Re-applies the shortcut's type if this screen was already mounted when
  // a new ?type= arrived — only while choosing, never mid-session.
  useEffect(() => {
    if ((typeParam === 'WALK' || typeParam === 'RUN' || typeParam === 'CYCLING') && phase === 'SELECT') setActType(typeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeParam]);


  const tracking = useActivityTracking(actType);
  const { stats } = tracking;

  const bannerY = useRef(new Animated.Value(-80)).current;
  const prevSplitCountRef = useRef(0);

  const cfg = ACT[actType];

  // ── App-kill recovery — check once on mount for a session that never got
  // a normal finish (see activeTrackingSession.ts). Runs before/alongside
  // the GPS bootstrap below since finding one takes over the whole screen
  // regardless of GPS readiness. ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const session = await loadTrackingSession();
      if (session) setResumableSession(session);
    })();
  }, []);

  const handleResumeSession = useCallback(async () => {
    if (!resumableSession) return;
    setResuming(true);
    try {
      setActType(resumableSession.activityType);
      await tracking.resumeFromSession(resumableSession);
      setPhase(resumableSession.phase === 'PAUSED' ? 'PAUSED' : 'ACTIVE');
      setResumableSession(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.warn('[ActivityTracker] failed to resume session:', e);
      Alert.alert(
        "Couldn't resume your activity",
        `Your previous session's data is still saved — you can try again, or discard it and start fresh.${e?.message ? `\n\n(${e.message})` : ''}`
      );
    } finally {
      setResuming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumableSession]);

  const handleDiscardSession = useCallback(() => {
    Alert.alert('Discard this activity?', "This can't be undone — the distance and time recorded so far will be lost.", [
      { text: 'Keep It', style: 'cancel' },
      {
        text: 'Discard', style: 'destructive', onPress: async () => {
          await clearTrackingSession();
          setResumableSession(null);
        },
      },
    ]);
  }, []);

  // ── GPS bootstrap (one-shot, for the "ready to start" screen only —
  // the actual tracking session's GPS comes from useActivityTracking) ──────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('ERROR');
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setGpsStatus('READY');

        try {
          const [place] = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (place) {
            const parts = [place.street || place.name, place.district || place.city || place.subregion].filter(Boolean);
            setPlaceName(parts.length > 0 ? parts.join(', ') : place.city || place.region || null);
          }
        } catch {
          // Leave placeName null — UI falls back to a generic "current location" label.
        }
      } catch {
        setGpsStatus('ERROR');
      }
    })();
  }, []);

  // ── Milestone banner — fires off the real split tracker, not a separate
  // ad-hoc distance check, so it's tied to the same authoritative source as
  // the splits shown on the summary screen. ────────────────────────────────
  const showMilestone = useCallback((text: string) => {
    setMilestoneBanner(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    bannerY.setValue(-80);
    Animated.sequence([
      Animated.spring(bannerY, { toValue: 0, useNativeDriver: true, tension: 150, friction: 8 }),
      Animated.delay(2500),
      Animated.timing(bannerY, { toValue: -80, duration: 400, useNativeDriver: true }),
    ]).start(() => setMilestoneBanner(null));
  }, []);

  useEffect(() => {
    if (stats.splits.length > prevSplitCountRef.current) {
      const km = stats.splits.length;
      prevSplitCountRef.current = km;
      const msgs = [`${km} km done! Keep it up! 💪`, `Amazing! You hit ${km} km! 🔥`, `${km} km! You're unstoppable! ⚡`];
      showMilestone(msgs[km % msgs.length]);
    }
  }, [stats.splits.length, showMilestone]);

  // ── Keep the live map camera following the user as new samples arrive
  // (the hook only updates `stats`, it has no map ref of its own). ─────────
  useEffect(() => {
    if ((phase !== 'ACTIVE' && phase !== 'PAUSED') || !stats.currentLocation) return;
    mapRef.current?.animateToRegion({
      latitude: stats.currentLocation.latitude,
      longitude: stats.currentLocation.longitude,
      latitudeDelta: 0.003,
      longitudeDelta: 0.003,
    }, 800);
  }, [stats.currentLocation, phase]);

  // ── Countdown & start ─────────────────────────────────────────────────────
  const beginCountdown = useCallback(() => {
    setPhase('COUNTDOWN');
    setStarting(false);
    setCountdown(3);
    let count = 3;
    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
        // The "1" tick is the last thing the countdown UI renders — starting
        // tracking itself (permission checks, registering the background
        // location task) is async and can take a few seconds, so flip to a
        // distinct "starting" state rather than leaving "1" on screen with
        // no visible indication anything is still happening.
        setStarting(true);
        beginTracking();
      } else {
        setCountdown(count);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actType]);

  // Countdown interval is only ever meant to outlive the COUNTDOWN phase by
  // a few seconds at most — if the screen unmounts mid-countdown (user backs
  // out), this stops it from firing beginTracking() on a gone screen later.
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const beginTracking = useCallback(async () => {
    prevSplitCountRef.current = 0;
    try {
      const { started } = await tracking.start();
      if (!started) {
        Alert.alert(
          'Location is off',
          'Paasxo needs location access to measure your distance and route. Choose "While Using the App" for Paasxo in Settings.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
          ],
        );
        setPhase('SELECT');
        return;
      }
      // "While Using" access is enough — a session started here keeps
      // recording with the phone locked (see useActivityTracking's start()).
      setPhase('ACTIVE');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      // A permission/config failure here (e.g. background location not yet
      // granted) must never leave the countdown screen frozen — surface it
      // and let the user retry instead of failing silently. The real
      // underlying message is appended (not just a generic line) so a
      // failure here is actually diagnosable from the alert alone — see
      // useActivityTracking.ts's start(), which now rethrows with the
      // native error's own message attached instead of swallowing it.
      console.warn('[ActivityTracker] failed to start tracking:', e);
      Alert.alert(
        "Couldn't start tracking",
        `Something went wrong starting GPS tracking. Please check that location access is enabled for Paasxo and try again.${e?.message ? `\n\n(${e.message})` : ''}`
      );
      setPhase('SELECT');
    } finally {
      setStarting(false);
    }
    // `tracking` (hence tracking.start) must be a real dependency, not
    // omitted — see the doc comment below.
  }, [tracking]);

  // ── Pause / Resume ────────────────────────────────────────────────────────
  // beginTracking/handlePause/handleResume all depend on `tracking` itself
  // (not just activity-type-ish pieces of it) because `tracking` is a brand
  // new object every render (useActivityTracking(actType) isn't memoized) —
  // an empty dep array here would freeze these callbacks on whatever
  // `tracking` existed at the component's very first render (bound to
  // actType's default), permanently ignoring every later activity-type
  // selection. That exact bug was shipped once already: the live
  // notification and the saved activity both kept reporting "Run" no matter
  // what the user actually picked, because beginTracking() was calling a
  // start() still closed over the default type from mount.
  const handlePause = useCallback(async () => {
    await tracking.pause();
    setPhase('PAUSED');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, [tracking]);

  const handleResume = useCallback(async () => {
    await tracking.resume();
    setPhase('ACTIVE');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [tracking]);

  // Another tracker screen took over (or finished) this session — leave the
  // live view instead of showing a frozen/ticking timer for a dead session.
  useEffect(() => {
    if (tracking.superseded && (phase === 'ACTIVE' || phase === 'PAUSED')) setPhase('SELECT');
  }, [tracking.superseded, phase]);

  const [finishing, setFinishing] = useState(false);
  const finishingGuard = useRef(false);

  const finishActivity = useCallback(async () => {
    if (finishingGuard.current) return; // double-tap / notification + button
    finishingGuard.current = true;
    setFinishing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await finishActivityInner();
    } finally {
      finishingGuard.current = false;
      setFinishing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actType, user?.weightKg]);

  const finishActivityInner = async () => {
    const result = await tracking.stop();
    const last = result.route[result.route.length - 1];

    const bestPace = bestSplitPaceSecPerKm(result.splits);
    const bestSpeed = bestSplitSpeedKmh(result.splits);
    const best400m = fastest400mSeconds(result.route);
    const calories = calcCalories(actType as MetActivityType, result.avgSpeedKmh, result.durationSeconds, user?.weightKg, result.splits);

    const activity: StoredActivity = {
      localId: genLocalId(),
      type: actType,
      title: autoTitle(actType),
      startTime: result.startTime.toISOString(),
      endTime: result.endTime.toISOString(),
      durationSeconds: result.durationSeconds,
      distanceMeters: result.distanceMeters,
      avgSpeedKmh: result.avgSpeedKmh,
      maxSpeedKmh: result.maxSpeedKmh,
      avgPaceSecPerKm: result.avgPaceSecPerKm,
      elevationGainMeters: result.elevationGainMeters,
      elevationLossMeters: result.elevationLossMeters,
      stepCount: result.stepCount,
      calories,
      bestSplitPaceSecPerKm: bestPace,
      bestSplitSpeedKmh: bestSpeed,
      best400mSeconds: best400m,
      splits: result.splits,
      routeCoordinates: result.route,
      startLatitude: result.startLatitude,
      startLongitude: result.startLongitude,
      endLatitude: result.endLatitude,
      endLongitude: result.endLongitude,
      // Same default the activity-sharing flow already uses for the Post it
      // creates — changeable on the summary screen before saving.
      visibility: 'friends',
    };

    // Compare against every PRIOR activity of the same type (local history —
    // the same source ActivityHistoryScreen already reads) to see whether
    // this one just set a new personal record. Intentionally excludes the
    // activity just finished (it isn't saved yet at this point).
    const priorSameType = (await activityStorage.getAll()).filter((a) => a.type === actType);
    const records: string[] = [];
    if (bestPace != null) {
      const prevBest = priorSameType.reduce<number | null>((min, a) =>
        a.bestSplitPaceSecPerKm != null && (min == null || a.bestSplitPaceSecPerKm < min) ? a.bestSplitPaceSecPerKm : min, null);
      if (prevBest == null || bestPace < prevBest) records.push(`⚡ New fastest km: ${formatPace(bestPace)} /km`);
    }
    if (best400m != null) {
      const prevBest = priorSameType.reduce<number | null>((min, a) =>
        a.best400mSeconds != null && (min == null || a.best400mSeconds < min) ? a.best400mSeconds : min, null);
      if (prevBest == null || best400m < prevBest) records.push(`🔥 New fastest 400m: ${formatTime(best400m)}`);
    }
    const prevLongestDist = priorSameType.reduce((max, a) => Math.max(max, a.distanceMeters), 0);
    if (result.distanceMeters > prevLongestDist && priorSameType.length > 0) {
      records.push(`🏆 New longest ${ACT[actType].label.toLowerCase()}: ${formatDist(result.distanceMeters)}${distUnit(result.distanceMeters)}`);
    }
    const prevLongestDuration = priorSameType.reduce((max, a) => Math.max(max, a.durationSeconds), 0);
    if (result.durationSeconds > prevLongestDuration && priorSameType.length > 0) {
      records.push(`⏱️ New longest ${ACT[actType].label.toLowerCase()} duration: ${formatTime(result.durationSeconds)}`);
    }
    setNewRecords(records);
    setSavedServerId(null);
    setShareBusy(null);

    setCompletedActivity(activity);
    setPhase('SUMMARY');

    if (result.route.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(result.route, {
          edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
          animated: true,
        });
      }, 600);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Stop & finish ─────────────────────────────────────────────────────────
  // Depends on finishActivity (not []) for the same reason beginTracking
  // depends on tracking above — an empty array would permanently call
  // whichever finishActivity existed at mount, saving every activity as
  // whatever actType happened to default to, regardless of what was
  // actually selected and tracked.
  const handleStop = useCallback(() => {
    Alert.alert('Finish Activity?', 'This will end your current session.', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Finish', style: 'destructive', onPress: finishActivity },
    ]);
  }, [finishActivity]);

  // ── Lock-screen/notification control ─────────────────────────────────────
  // The Pause/Resume/Stop buttons on the live activity notification work
  // without unlocking the phone — see activityControlBus.ts/activityNotification.ts.
  // Pause/Resume apply immediately; Stop still routes through the same
  // confirm dialog as the in-app Stop button (the notification action is
  // configured to bring the app to the foreground specifically so that
  // dialog is visible).
  //
  // handlePause/handleResume/handleStop all get a fresh identity on every
  // render now (they depend on `tracking`/`finishActivity`, which are
  // themselves fresh every render while a session is live — see those
  // definitions above) — subscribing to the control bus directly off those
  // deps would unsubscribe/resubscribe on every single stats tick (every
  // ~2s). Routing calls through a ref instead means the two effects below
  // only need to resubscribe when `phase` itself actually changes, while
  // still always invoking whichever handler is current.
  const handlePauseRef = useRef(handlePause);
  const handleResumeRef = useRef(handleResume);
  const handleStopRef = useRef(handleStop);
  handlePauseRef.current = handlePause;
  handleResumeRef.current = handleResume;
  handleStopRef.current = handleStop;

  useEffect(() => {
    if (phase !== 'ACTIVE' && phase !== 'PAUSED') return;
    return subscribeActivityControl((action) => {
      if (action === 'PAUSE' && phase === 'ACTIVE') handlePauseRef.current();
      else if (action === 'RESUME' && phase === 'PAUSED') handleResumeRef.current();
      else if (action === 'STOP') handleStopRef.current();
    });
  }, [phase]);

  // Picks up a control tap that arrived while this screen wasn't mounted
  // yet (e.g. the app was fully backgrounded) — subscribeActivityControl
  // above only catches one dispatched while it's actively subscribed.
  useEffect(() => {
    if (phase !== 'ACTIVE' && phase !== 'PAUSED') return;
    (async () => {
      const pending = await consumePendingActivityControl();
      if (pending === 'PAUSE' && phase === 'ACTIVE') handlePauseRef.current();
      else if (pending === 'RESUME' && phase === 'PAUSED') handleResumeRef.current();
      else if (pending === 'STOP') handleStopRef.current();
    })();
  }, [phase]);

  // Who can view this activity once saved (its detail page/share link, and
  // whether it counts toward a friend's view of your profile Stats) — picked
  // on the summary screen before Save, same tri-state Posts already use.
  const handleSetVisibility = useCallback((visibility: ActivityVisibility) => {
    setCompletedActivity((prev) => (prev ? { ...prev, visibility } : prev));
  }, []);

  // ── Save activity ──────────────────────────────────────────────────────────
  // Saves locally + kicks off the server sync but doesn't block "Saved!" on
  // the network round-trip finishing — see ensureSavedAndSynced below for
  // the version the share actions use, which DOES need to wait (a share
  // link is only real once a serverId exists).
  // Leaves the tracker after a save: the finished session is fully closed
  // (nothing live, nothing resumable), so the screen is reset first.
  const leaveAfterSave = useCallback((toHistory: boolean) => {
    setCompletedActivity(null);
    setNewRecords([]);
    setPhase('SELECT');
    if (toHistory) router.replace('/activity-history' as any);
    else goBack(router);
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!completedActivity || saving) return;
    setSaving(true);
    try {
      const withDesign = await withShareDesignRef.current(completedActivity);
      setCompletedActivity(withDesign);
      await activityStorage.save(withDesign);
      // Only one server copy per activity, however many times Save/Share is tapped.
      if (!savedServerId && !syncPromiseRef.current) {
        syncPromiseRef.current = activityApi.syncToServer(withDesign)
          .then((id) => {
            if (id) {
              setSavedServerId(id);
              activityStorage.save({ ...withDesign, serverId: id }).catch(() => {});
            }
            return id;
          })
          .catch(() => null)
          .finally(() => { syncPromiseRef.current = null; });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved!', 'Your activity has been saved to your history with the design you picked.', [
        { text: 'View History', onPress: () => leaveAfterSave(true) },
        { text: 'Done', onPress: () => leaveAfterSave(false) },
      ]);
    } catch {
      Alert.alert('Couldn’t save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [completedActivity, saving, savedServerId, leaveAfterSave]);

  /**
   * Every share destination (Story/Post/external) needs the activity to
   * already exist server-side — that's what the shared link actually points
   * at. Saves it first if the user hasn't tapped "Save Activity" yet
   * (sharing shouldn't be blocked on a separate save step), and is a no-op
   * if already saved+synced from a previous share attempt in this session.
   */
  const ensureSavedAndSynced = useCallback(async (): Promise<string | null> => {
    if (!completedActivity) return null;
    if (savedServerId) return savedServerId;
    if (syncPromiseRef.current) return syncPromiseRef.current;
    const withDesign = await withShareDesignRef.current(completedActivity);
    setCompletedActivity(withDesign);
    await activityStorage.save(withDesign);
    syncPromiseRef.current = activityApi.syncToServer(withDesign)
      .then((id) => {
        if (id) {
          setSavedServerId(id);
          activityStorage.save({ ...withDesign, serverId: id }).catch(() => {});
        }
        return id;
      })
      .catch(() => null)
      .finally(() => { syncPromiseRef.current = null; });
    return syncPromiseRef.current;
  }, [completedActivity, savedServerId]);

  const {
    ShareCardPortal, SharePreview, buildShareCard,
    templateId, setTemplateId, aspectRatio, setAspectRatio,
    photoUri, pickPhoto, ensureMapSnapshot,
  } = useActivityShareCard(completedActivity, user?.displayName || 'A Paasxo user', newRecords);

  withShareDesignRef.current = async (a: StoredActivity) => {
    let sharePhotoUri: string | undefined;
    if (templateId === 'photo' && photoUri) sharePhotoUri = await persistActivityPhoto(photoUri, a.localId);
    return { ...a, shareTemplateId: templateId, shareAspectRatio: aspectRatio, sharePhotoUri };
  };

  // Proactively snapshots the route map as soon as there's something to
  // share, so the design preview below has a background ready the instant
  // the user scrolls to it instead of only fetching it lazily on first
  // share tap. mapRef is already the live MapView showing the fitted route.
  useEffect(() => {
    if (phase === 'SUMMARY') ensureMapSnapshot(mapRef);
  }, [phase, ensureMapSnapshot]);

  const handlePickPhotoForCard = useCallback(async (source: 'camera' | 'library') => {
    const picked = await pickPhoto(source);
    if (!picked) return;
    if (templateId !== 'photo') setTemplateId('photo');
  }, [pickPhoto, templateId, setTemplateId]);

  const handleShareToStory = useCallback(async (confirmed = false) => {
    if (!completedActivity || shareBusy) return;
    // Stories are seen by followers — don't quietly publish an "Only Me" activity.
    if (completedActivity.visibility === 'private' && !confirmed) {
      Alert.alert(
        'This activity is set to Only Me',
        'Your Story is visible to your followers for 24 hours. Share this activity there anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share to Story', onPress: () => { handleShareToStoryRef.current(true); } },
        ],
      );
      return;
    }
    setShareBusy('story');
    try {
      const serverId = await ensureSavedAndSynced();
      const cardUri = await buildShareCard(mapRef, serverId ? activityShareUrl(serverId) : null, 'story', templateId);
      if (!cardUri) throw new Error('Could not generate the share image');
      await storyApi.createStory({ mediaUri: cardUri, mediaType: 'IMAGE', mimeType: 'image/jpeg', filterName: 'NORMAL' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Shared to your Story!');
    } catch (e: any) {
      Alert.alert('Could not share to Story', extractApiError(e, 'Please try again.'));
    } finally {
      setShareBusy(null);
    }
  }, [completedActivity, shareBusy, ensureSavedAndSynced, buildShareCard, templateId]);

  const handleShareToPost = useCallback(async (visibilityOverride?: ActivityVisibility) => {
    if (!completedActivity || shareBusy) return;
    // The post follows the "Who can see this activity?" choice above.
    const postVisibility: ActivityVisibility = visibilityOverride ?? completedActivity.visibility ?? 'friends';
    if (postVisibility === 'private' && !visibilityOverride) {
      Alert.alert(
        'This activity is set to Only Me',
        'A post set to Only Me appears on your profile but nobody else sees it. Who should see this post?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Only Me', onPress: () => { handleShareToPostRef.current('private'); } },
          { text: 'Friends', onPress: () => { handleShareToPostRef.current('friends'); } },
        ],
      );
      return;
    }
    setShareBusy('post');
    try {
      const serverId = await ensureSavedAndSynced();
      const cardUri = await buildShareCard(mapRef, serverId ? activityShareUrl(serverId) : null, 'post', templateId);
      if (!cardUri) throw new Error('Could not generate the share image');
      const caption = `${ACT[actType].emoji} ${formatDist(completedActivity.distanceMeters)}${distUnit(completedActivity.distanceMeters)} ${ACT[actType].label.toLowerCase()} in ${formatTime(completedActivity.durationSeconds)} on Paasxo 💪`;
      await socialMediaApi.createPost({
        caption,
        media: { uri: cardUri, fileName: 'activity.jpg', mimeType: 'image/jpeg' },
        sport: 'FITNESS',
        visibility: postVisibility,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Posted!',
        postVisibility === 'public' ? 'Your activity is on the Paasxo feed for everyone.'
          : postVisibility === 'friends' ? 'Your activity is on the feed for your friends.'
          : 'Your activity is on your profile — only you can see it.',
      );
    } catch (e: any) {
      Alert.alert('Could not share as a Post', extractApiError(e, 'Please try again.'));
    } finally {
      setShareBusy(null);
    }
  }, [completedActivity, actType, shareBusy, ensureSavedAndSynced, buildShareCard, templateId]);

  const handleShareToStoryRef = useRef(handleShareToStory);
  handleShareToStoryRef.current = handleShareToStory;
  const handleShareToPostRef = useRef(handleShareToPost);
  handleShareToPostRef.current = handleShareToPost;

  // Shares outside Paasxo (WhatsApp, Messages, etc). expo-sharing is used
  // rather than RN's built-in Share so the image attaches reliably on
  // Android too (a raw file:// url passed to Share.share works inconsistently
  // there without a configured FileProvider) — but that API can't attach a
  // text caption alongside the file on every platform, which is why the
  // link is baked directly onto the card image itself (see
  // ActivityShareCard's shareUrl prop) rather than only appended to a
  // message that might not travel with it.
  const handleShareExternal = useCallback(async () => {
    if (!completedActivity || shareBusy) return;
    setShareBusy('external');
    try {
      const serverId = await ensureSavedAndSynced();
      const cardUri = await buildShareCard(mapRef, serverId ? activityShareUrl(serverId) : null, 'post', templateId);
      if (cardUri) {
        try {
          // Lazily required: expo-sharing's native module isn't registered on
          // every build (e.g. simulators without it linked), and a static
          // top-level import throws synchronously at module-load time,
          // crashing this whole screen before it can render.
          const Sharing = require('expo-sharing') as typeof import('expo-sharing');
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(cardUri, { mimeType: 'image/jpeg', dialogTitle: 'Share your activity' });
            return;
          }
        } catch {
          // Native module unavailable — fall through to the plain-text share below.
        }
      }
      // Fallback (web, or a device without a share sheet available) — plain
      // text share, same as before this feature existed.
      const { durationSeconds, distanceMeters, avgPaceSecPerKm, elevationGainMeters, elevationLossMeters, stepCount } = completedActivity;
      const message =
        `${ACT[actType].emoji} ${ACT[actType].label} complete on Paasxo!\n\n` +
        `📍 Distance: ${formatDist(distanceMeters)} ${distUnit(distanceMeters)}\n` +
        `⏱️ Duration: ${formatTime(durationSeconds)}\n` +
        `🏃 Pace: ${formatPace(avgPaceSecPerKm)} /km\n` +
        `⛰️ Elevation: ${elevationGainMeters}m gain, ${elevationLossMeters}m loss` +
        (stepCount ? `\n👣 Steps: ${stepCount}` : '') +
        (serverId ? `\n\n${activityShareUrl(serverId)}` : '');
      await Share.share({ message });
    } catch {
      // User cancelled the share sheet — no error surfaced.
    } finally {
      setShareBusy(null);
    }
  }, [completedActivity, actType, shareBusy, ensureSavedAndSynced, buildShareCard, templateId]);

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard Activity?', 'This activity will not be saved.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => goBack(router) },
    ]);
  }, [router]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER PHASES
  // ─────────────────────────────────────────────────────────────────────────────

  const renderSelectPhase = () => (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#0F172A', '#1E293B', '#0F172A']} style={StyleSheet.absoluteFill} />
      {/* Background orbs */}
      <Orb color={cfg.accentColor} size={220} top={-60} left={-60} delay={0} />
      <Orb color={cfg.accentColor} size={180} top={SCREEN_H * 0.4} left={SCREEN_W - 100} delay={1200} />
      <Orb color={cfg.accentColor} size={140} top={SCREEN_H * 0.65} left={40} delay={600} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => goBack(router)} style={styles.backBtn}>
            <ArrowLeft color={Colors.white} size={20} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Start Activity</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Activity picker — three tiles */}
          <View style={styles.pickRow}>
            {(['WALK', 'RUN', 'CYCLING'] as ActivityType[]).map((t) => {
              const c = ACT[t];
              const selected = actType === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => { if (!selected) { setActType(t); Haptics.selectionAsync(); } }}
                  activeOpacity={0.85}
                  style={[styles.pickTile, selected && { borderColor: c.accentColor, backgroundColor: c.accentColor + '26' }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={c.label}
                >
                  <View style={[styles.pickIcon, { backgroundColor: selected ? c.accentColor : 'rgba(255,255,255,0.08)' }]}>
                    <MaterialCommunityIcons name={c.icon} size={26} color={selected ? Colors.white : Colors.neutral300} />
                  </View>
                  <Text style={[styles.pickLabel, selected && { color: Colors.white }]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Hero card for the selected activity */}
          <LinearGradient colors={cfg.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            <View style={styles.heroGlyph} pointerEvents="none">
              <MaterialCommunityIcons name={cfg.icon} size={150} color="rgba(255,255,255,0.14)" />
            </View>
            <Text style={styles.heroKicker}>READY TO {actType === 'CYCLING' ? 'RIDE' : actType === 'RUN' ? 'RUN' : 'WALK'}</Text>
            <Text style={styles.heroTitle}>{cfg.label}</Text>
            <Text style={styles.heroBody}>{cfg.guideText}</Text>
            <View style={styles.heroChips}>
              {[
                { icon: <MapPin color={Colors.white} size={13} strokeWidth={2.5} />, text: 'Route map' },
                { icon: <Zap color={Colors.white} size={13} strokeWidth={2.5} />, text: 'Pace & splits' },
                { icon: <TrendingUp color={Colors.white} size={13} strokeWidth={2.5} />, text: 'Calories' },
              ].map((f) => (
                <View key={f.text} style={styles.heroChip}>
                  {f.icon}
                  <Text style={styles.heroChipText}>{f.text}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {/* GPS status */}
          <View style={[styles.gpsPill, gpsStatus === 'READY' && { borderColor: 'rgba(34,197,94,0.45)' }, gpsStatus === 'ERROR' && { borderColor: 'rgba(239,68,68,0.5)' }]}>
            {gpsStatus === 'READY' ? (
              <GpsDot color="#22C55E" />
            ) : gpsStatus === 'ERROR' ? (
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.error }} />
            ) : (
              <GpsDot color={Colors.warning} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.gpsText}>
                {gpsStatus === 'READY'
                  ? 'GPS locked'
                  : gpsStatus === 'ERROR'
                  ? 'Location is off for Paasxo'
                  : 'Finding your GPS signal…'}
              </Text>
              <Text style={styles.gpsCoord} numberOfLines={1}>
                {gpsStatus === 'READY'
                  ? (placeName ?? 'Current location')
                  : gpsStatus === 'ERROR'
                  ? 'Turn it on in Settings → Paasxo → Location'
                  : 'Head outdoors for the best accuracy'}
              </Text>
            </View>
            {gpsStatus === 'ERROR' && (
              <TouchableOpacity onPress={() => Linking.openSettings().catch(() => {})} style={styles.gpsSettingsBtn} accessibilityRole="button">
                <Text style={styles.gpsSettingsText}>Settings</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Start */}
          <StartRing colors={cfg.colors} ready={gpsStatus === 'READY'} label={cfg.label} onPress={beginCountdown} />
          <Text style={styles.startHint}>
            3-second countdown, then go. Keeps recording with your phone locked.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );

  const renderCountdownPhase = () => (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={StyleSheet.absoluteFill} />
      <Orb color={cfg.accentColor} size={300} top={SCREEN_H / 2 - 150} left={SCREEN_W / 2 - 150} delay={0} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Avatar type={actType} active={false} />
        <View style={{ height: 32 }} />
        <Countdown value={countdown} color={cfg.accentColor} starting={starting} />
      </View>
    </View>
  );

  const renderActivePhase = (paused: boolean) => {
    const cycling = actType === 'CYCLING';
    // "Now" = last ~30s of the route; "Avg" = whole session (moving time).
    const nowPace = stats.rollingPaceSecPerKm;
    const nowValue = cycling
      ? (nowPace ? (3600 / nowPace).toFixed(1) : '0.0')
      : formatPace(paused ? null : nowPace);
    const avgValue = cycling ? stats.avgSpeedKmh.toFixed(1) : formatPace(stats.currentPaceSecPerKm);
    const paceUnit = cycling ? 'km/h' : '/km';
    const liveCalories = calcCalories(actType as MetActivityType, stats.avgSpeedKmh, stats.elapsedSeconds, user?.weightKg, stats.splits);

    return (
      <View style={{ flex: 1, backgroundColor: '#0B1220' }}>
        {/* Map — takes all space the metrics sheet doesn't need */}
        <View style={styles.liveMapContainer}>
          {stats.currentLocation || currentLoc ? (
            <MapView
              ref={mapRef}
              provider={PROVIDER_DEFAULT}
              style={StyleSheet.absoluteFill}
              initialRegion={{
                latitude: (stats.currentLocation ?? currentLoc)!.latitude,
                longitude: (stats.currentLocation ?? currentLoc)!.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              showsUserLocation
              showsMyLocationButton={false}
              showsCompass={false}
              mapType="standard"
            >
              {stats.mapCoords.length > 1 && (
                <Polyline
                  coordinates={stats.mapCoords}
                  strokeColor={cfg.accentColor}
                  strokeWidth={6}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              {stats.mapCoords.length > 0 && (
                <Marker coordinate={stats.mapCoords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={[styles.startMarker, { backgroundColor: cfg.accentColor }]}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: Colors.white }}>S</Text>
                  </View>
                </Marker>
              )}
            </MapView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B' }}>
              <Navigation color={cfg.accentColor} size={32} />
              <Text style={{ color: Colors.neutral400, marginTop: 12 }}>Acquiring location…</Text>
            </View>
          )}

          {/* Overlay status bar */}
          <SafeAreaView edges={['top']} style={styles.mapOverlay}>
            <View style={styles.mapStatusRow}>
              <View style={[styles.statusPill, { backgroundColor: paused ? '#F59E0B' : cfg.accentColor }]}>
                <GpsDot color={Colors.white} />
                <Text style={styles.statusPillText}>{paused ? 'PAUSED' : `${cfg.label.toUpperCase()} · LIVE`}</Text>
              </View>
              {(stats.currentLocation || currentLoc) && (
                <TouchableOpacity
                  onPress={() => {
                    const c = stats.currentLocation ?? currentLoc;
                    if (c) mapRef.current?.animateToRegion({ ...c, latitudeDelta: 0.003, longitudeDelta: 0.003 }, 500);
                  }}
                  style={styles.recenterBtn}
                  accessibilityLabel="Re-centre map"
                >
                  <Navigation color={Colors.white} size={16} strokeWidth={2.6} />
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </View>

        {/* Metrics sheet */}
        <View style={styles.metricsPanel}>
          <View style={styles.sheetHandle} />

          {/* Distance — the hero number */}
          <View style={styles.distBlock}>
            <View style={styles.distRow}>
              <Text style={styles.distValue} allowFontScaling={false} accessibilityLabel={`Distance ${formatDist(stats.distanceMeters)} ${distUnit(stats.distanceMeters) === 'km' ? 'kilometres' : 'metres'}`}>
                {formatDist(stats.distanceMeters)}
              </Text>
              <Text style={styles.distUnit}>{distUnit(stats.distanceMeters) === 'km' ? 'km' : 'm'}</Text>
            </View>
            <Text style={styles.distLabel}>DISTANCE</Text>
          </View>

          {/* Primary row: time · now · avg */}
          <View style={styles.primaryRow}>
            <PrimaryStat label="TIME" value={formatTime(stats.elapsedSeconds)} color={cfg.accentColor} />
            <View style={styles.primaryDivider} />
            <PrimaryStat label={cycling ? 'SPEED' : 'PACE'} value={nowValue} unit={paceUnit} />
            <View style={styles.primaryDivider} />
            <PrimaryStat label={cycling ? 'AVG SPEED' : 'AVG PACE'} value={avgValue} unit={paceUnit} />
          </View>

          {/* Secondary tiles */}
          <View style={styles.statsGrid}>
            <StatTile
              label="Calories"
              value={liveCalories != null ? `${liveCalories}` : '—'}
              unit={liveCalories != null ? 'kcal' : 'add weight'}
              Icon={<Zap color="#F59E0B" size={13} />}
              onPress={liveCalories == null ? () => router.push('/edit-profile' as any) : undefined}
            />
            <StatTile label="Elevation" value={`+${stats.elevationGainMeters}`} unit="m gain" Icon={<TrendingUp color="#8B5CF6" size={13} />} />
            {cycling ? (
              <StatTile label="Max speed" value={stats.maxSpeedKmh.toFixed(1)} unit="km/h" Icon={<Wind color={cfg.accentColor} size={13} />} />
            ) : (
              <StatTile label="Steps" value={stats.stepCount != null ? stats.stepCount.toLocaleString() : '—'} unit="steps" Icon={<Footprints color="#F97316" size={13} />} />
            )}
          </View>

          {/* Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              onPress={paused ? handleResume : handlePause}
              style={[styles.ctrlBtn, { backgroundColor: paused ? cfg.accentColor : '#1F2A3D' }]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={paused ? 'Resume' : 'Pause'}
            >
              {paused
                ? <Play color={Colors.white} size={22} fill={Colors.white} />
                : <Pause color={Colors.white} size={22} fill={Colors.white} />}
              <Text style={styles.ctrlText}>{paused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleStop}
              style={[styles.ctrlBtn, { backgroundColor: '#DC2626' }]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Finish activity"
            >
              <Square color={Colors.white} size={18} fill={Colors.white} />
              <Text style={styles.ctrlText}>Finish</Text>
            </TouchableOpacity>
          </View>

          {/* Milestone banner */}
          {milestoneBanner && (
            <Animated.View style={[styles.milestoneBanner, { transform: [{ translateY: bannerY }], backgroundColor: cfg.accentColor }]}>
              <Trophy color={Colors.white} size={18} />
              <Text style={styles.milestoneBannerText}>{milestoneBanner}</Text>
            </Animated.View>
          )}
        </View>
      </View>
    );
  };

  const renderSummaryPhase = () => {
    if (!completedActivity) return null;
    const {
      durationSeconds, distanceMeters, avgPaceSecPerKm,
      elevationGainMeters, elevationLossMeters, stepCount, splits, routeCoordinates, calories,
    } = completedActivity;
    const bestPace = completedActivity.bestSplitPaceSecPerKm;

    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
        {/* Route map (top 38%) */}
        <View style={{ height: SCREEN_H * 0.38 }}>
          {routeCoordinates.length > 1 ? (
            <MapView
              ref={mapRef}
              provider={PROVIDER_DEFAULT}
              style={StyleSheet.absoluteFill}
              showsUserLocation={false}
              showsCompass={false}
              mapType="standard"
              initialRegion={{
                latitude: routeCoordinates[0].latitude,
                longitude: routeCoordinates[0].longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Polyline
                coordinates={routeCoordinates}
                strokeColor={cfg.accentColor}
                strokeWidth={5}
                lineCap="round"
              />
              <Marker coordinate={routeCoordinates[0]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.startMarker, { backgroundColor: '#22C55E' }]}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: Colors.white }}>S</Text>
                </View>
              </Marker>
              <Marker coordinate={routeCoordinates[routeCoordinates.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.startMarker, { backgroundColor: Colors.error }]}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: Colors.white }}>F</Text>
                </View>
              </Marker>
            </MapView>
          ) : (
            <LinearGradient colors={['#1E293B', '#0F172A']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <MapPin color={cfg.accentColor} size={40} />
              <Text style={{ color: Colors.neutral400, marginTop: 8 }}>No route data</Text>
            </LinearGradient>
          )}

          {/* Summary header overlay */}
          <LinearGradient colors={['rgba(15,23,42,0.85)', 'transparent']} style={styles.summaryMapOverlay}>
            <SafeAreaView edges={['top']}>
              <View style={styles.summaryHeaderRow}>
                <View style={[styles.actTypeBadge, { backgroundColor: cfg.accentColor }]}>
                  <Text style={styles.actTypeBadgeText}>{cfg.emoji} {cfg.label}</Text>
                </View>
                <Text style={styles.summaryDate}>
                  {new Date(completedActivity.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {/* Great job banner */}
          <View style={styles.greatJobBanner}>
            <Text style={{ fontSize: 36 }}>🎉</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.greatJobTitle}>Activity Complete!</Text>
              <Text style={styles.greatJobSub}>{completedActivity.title}</Text>
            </View>
          </View>

          {/* Personal records set by this activity — see finishActivity */}
          {newRecords.length > 0 && (
            <View style={styles.recordsBanner}>
              <View style={styles.recordsHeader}>
                <Trophy color="#F59E0B" size={18} strokeWidth={2.5} />
                <Text style={styles.recordsTitle}>New Personal Best!</Text>
              </View>
              {newRecords.map((r) => (
                <Text key={r} style={styles.recordsItem}>{r}</Text>
              ))}
            </View>
          )}

          {/* Primary stats */}
          <View style={styles.primaryStats}>
            <View style={styles.primaryStatItem}>
              <Text style={[styles.primaryStatValue, { color: cfg.accentColor }]}>{formatDist(distanceMeters)}</Text>
              <Text style={styles.primaryStatUnit}>{distUnit(distanceMeters)}</Text>
              <Text style={styles.primaryStatLabel}>Distance</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.primaryStatItem}>
              <Text style={[styles.primaryStatValue, { color: cfg.accentColor }]}>{formatTime(durationSeconds)}</Text>
              <Text style={styles.primaryStatUnit}>hh:mm:ss</Text>
              <Text style={styles.primaryStatLabel}>Duration</Text>
            </View>
          </View>

          {/* Secondary stats grid */}
          <View style={styles.secondaryGrid}>
            <SummaryTile label="Avg Pace" value={formatPace(avgPaceSecPerKm)} unit="min/km" color="#F59E0B" />
            <SummaryTile label="Best Split" value={formatPace(bestPace)} unit="min/km" color="#3B82F6" />
            <SummaryTile label="Elevation" value={`+${elevationGainMeters}`} unit={`m · -${elevationLossMeters}m`} color="#10B981" />
            <SummaryTile label="Steps" value={stepCount != null ? `${stepCount}` : '—'} unit="steps" color="#F97316" />
            <SummaryTile label="Splits" value={`${splits.length}`} unit="recorded" color="#6366F1" />
            {calories != null && <SummaryTile label="Calories" value={`${calories}`} unit="kcal (est.)" color="#EF4444" />}
          </View>

          {/* Per-km splits */}
          {splits.length > 0 && (
            <View style={styles.splitsSection}>
              <View style={styles.splitsHeader}>
                <ListOrdered color={cfg.accentColor} size={16} />
                <Text style={styles.splitsTitle}>Pace per Kilometer</Text>
              </View>
              {splits.map((s) => (
                <View key={s.index} style={styles.splitRow}>
                  <Text style={styles.splitIndex}>Km {s.index}</Text>
                  <Text style={styles.splitValue}>{formatPace(s.paceSecPerKm)} /km</Text>
                  <Text style={styles.splitDuration}>{formatTime(s.durationSeconds)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Share card design — live preview, updates instantly on every tap */}
          <Text style={styles.visibilityLabel}>Card design</Text>
          <View style={styles.previewWrap}>{SharePreview}</View>

          <View style={styles.aspectRow}>
            {(['post', 'story'] as const).map((ar) => {
              const active = aspectRatio === ar;
              return (
                <TouchableOpacity
                  key={ar}
                  onPress={() => setAspectRatio(ar)}
                  activeOpacity={0.8}
                  style={[styles.aspectPill, active && { backgroundColor: cfg.accentColor }]}
                >
                  <Text style={[styles.aspectPillText, active && { color: Colors.white }]}>
                    {ar === 'post' ? 'Post (4:5)' : 'Story (9:16)'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.templateRow}>
            {SHARE_CARD_TEMPLATES.map((t) => {
              const active = templateId === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setTemplateId(t.id)}
                  activeOpacity={0.8}
                  style={[styles.templatePill, active && { borderColor: cfg.accentColor, borderWidth: 2 }]}
                >
                  <LinearGradient colors={t.previewColors} style={styles.templateSwatch} />
                  <Text style={[styles.templatePillText, active && { color: cfg.accentColor }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {templateId === 'photo' && (
            <View style={styles.photoBtnRow}>
              <TouchableOpacity onPress={() => handlePickPhotoForCard('camera')} activeOpacity={0.8} style={[styles.takePhotoBtn, styles.photoBtnHalf]}
                accessibilityRole="button" accessibilityLabel={photoUri ? 'Retake photo' : 'Take photo'}>
                <Camera color={cfg.accentColor} size={16} strokeWidth={2.25} />
                <Text style={[styles.takePhotoBtnText, { color: cfg.accentColor }]}>
                  {photoUri ? 'Retake' : 'Take Photo'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handlePickPhotoForCard('library')} activeOpacity={0.8} style={[styles.takePhotoBtn, styles.photoBtnHalf]}
                accessibilityRole="button" accessibilityLabel="Choose a photo from your library">
                <ImageIcon color={cfg.accentColor} size={16} strokeWidth={2.25} />
                <Text style={[styles.takePhotoBtnText, { color: cfg.accentColor }]}>
                  {photoUri ? 'Change' : 'Choose Photo'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Who can see this activity */}
          <Text style={styles.visibilityLabel}>Who can see this activity?</Text>
          <View style={styles.visibilityRow}>
            {([
              { key: 'public' as const, label: 'Public', Icon: Globe },
              { key: 'friends' as const, label: 'Friends', Icon: Users },
              { key: 'private' as const, label: 'Only Me', Icon: Lock },
            ]).map(({ key, label, Icon }) => {
              const active = completedActivity.visibility === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => handleSetVisibility(key)}
                  activeOpacity={0.8}
                  style={[styles.visibilityPill, active && { backgroundColor: cfg.accentColor, borderColor: cfg.accentColor }]}
                >
                  <Icon color={active ? Colors.white : Colors.neutral400} size={14} strokeWidth={2.25} />
                  <Text style={[styles.visibilityPillText, active && { color: Colors.white }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85} style={{ marginTop: 12 }}>
            <LinearGradient colors={cfg.colors} style={styles.saveBtn}>
              <CheckCircle color={Colors.white} size={22} strokeWidth={2.5} />
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Activity'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Share to Paasxo — Story / Post */}
          <View style={styles.shareRow}>
            <TouchableOpacity
              onPress={() => handleShareToStory()}
              disabled={shareBusy !== null}
              activeOpacity={0.8}
              style={[styles.shareRowBtn, shareBusy === 'story' && styles.shareRowBtnBusy]}
            >
              {shareBusy === 'story' ? <ActivityIndicator color={cfg.accentColor} size="small" /> : <BookImage color={cfg.accentColor} size={18} strokeWidth={2.25} />}
              <Text style={[styles.shareBtnText, { color: cfg.accentColor }]}>To Story</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleShareToPost()}
              disabled={shareBusy !== null}
              activeOpacity={0.8}
              style={[styles.shareRowBtn, shareBusy === 'post' && styles.shareRowBtnBusy]}
            >
              {shareBusy === 'post' ? <ActivityIndicator color={cfg.accentColor} size="small" /> : <Send color={cfg.accentColor} size={18} strokeWidth={2.25} />}
              <Text style={[styles.shareBtnText, { color: cfg.accentColor }]}>As Post</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleShareExternal} disabled={shareBusy !== null} activeOpacity={0.8} style={styles.shareBtn}>
            {shareBusy === 'external' ? <ActivityIndicator color={cfg.accentColor} size="small" /> : <Share2 color={cfg.accentColor} size={18} strokeWidth={2.25} />}
            <Text style={[styles.shareBtnText, { color: cfg.accentColor }]}>Share Externally</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDiscard} activeOpacity={0.8} style={styles.discardBtn}>
            <Trash2 color={Colors.error} size={18} />
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>
        </ScrollView>
        {ShareCardPortal}
      </View>
    );
  };

  const renderResumePrompt = () => {
    const session = resumableSession!;
    const sessionCfg = ACT[session.activityType];
    // Same rule resumeFromSession applies: moving time as of the checkpoint,
    // plus time since then only if the session was still ACTIVE.
    const elapsedNow = session.activeMs != null
      ? Math.floor((session.activeMs + (session.phase === 'ACTIVE' && session.savedAt ? Math.max(0, Date.now() - session.savedAt) : 0)) / 1000)
      : Math.max(0, Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000));
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient colors={['#0F172A', '#1E293B', '#0F172A']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.resumeCenterWrap}>
            <Text style={styles.resumeEmoji}>{sessionCfg.emoji}</Text>
            <Text style={styles.resumeTitle}>Unfinished {sessionCfg.label}</Text>
            <Text style={styles.resumeSubtitle}>
              Paasxo was closed before this session ended. Your progress is still here.
            </Text>
            <View style={styles.resumeStatsRow}>
              <View style={styles.resumeStatItem}>
                <Text style={styles.resumeStatValue}>{formatDist(session.distanceMeters)}{distUnit(session.distanceMeters)}</Text>
                <Text style={styles.resumeStatLabel}>Distance</Text>
              </View>
              <View style={styles.resumeStatItem}>
                <Text style={styles.resumeStatValue}>{formatTime(elapsedNow)}</Text>
                <Text style={styles.resumeStatLabel}>Elapsed</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleResumeSession}
              disabled={resuming}
              activeOpacity={0.85}
              style={[styles.resumePrimaryBtn, { backgroundColor: sessionCfg.accentColor }]}
            >
              {resuming ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.resumePrimaryBtnText}>Resume Activity</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDiscardSession} disabled={resuming} activeOpacity={0.8} style={styles.resumeDiscardBtn}>
              <Text style={styles.resumeDiscardBtnText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  };

  // ── Phase router ──────────────────────────────────────────────────────────
  if (resumableSession) return renderResumePrompt();
  if (phase === 'SELECT') return renderSelectPhase();
  if (phase === 'COUNTDOWN') return renderCountdownPhase();
  const finishingOverlay = finishing ? (
    <View style={styles.finishingOverlay} accessibilityViewIsModal accessibilityLabel="Finishing your activity">
      <View style={styles.finishingCard}>
        <ActivityIndicator color={Colors.white} />
        <Text style={styles.finishingTitle}>Activity stopped</Text>
        <Text style={styles.finishingSub}>Saving your route and stats…</Text>
      </View>
    </View>
  ) : null;
  if (phase === 'ACTIVE') return <View style={{ flex: 1 }}>{renderActivePhase(false)}{finishingOverlay}</View>;
  if (phase === 'PAUSED') return <View style={{ flex: 1 }}>{renderActivePhase(true)}{finishingOverlay}</View>;
  if (phase === 'SUMMARY') return renderSummaryPhase();
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatTile({ label, value, unit, Icon, onPress }: { label: string; value: string; unit: string; Icon: React.ReactNode; onPress?: () => void }) {
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        {Icon}
        <Text style={styles.statTileLabel}>{label}</Text>
      </View>
      <Text style={styles.statTileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.statTileUnit, onPress && { color: '#60A5FA', fontWeight: '700' }]}>{unit}</Text>
    </>
  );
  return onPress
    ? <TouchableOpacity style={styles.statTile} onPress={onPress} activeOpacity={0.8}>{body}</TouchableOpacity>
    : <View style={styles.statTile}>{body}</View>;
}

function PrimaryStat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <View style={styles.primaryStat} accessible accessibilityLabel={`${label} ${value} ${unit ?? ''}`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={[styles.primaryValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>{value}</Text>
        {unit ? <Text style={styles.primaryUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.primaryLabel}>{label}</Text>
    </View>
  );
}

function SummaryTile({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={[styles.summaryTileValue, { color }]}>{value}</Text>
      <Text style={styles.summaryTileUnit}>{unit}</Text>
      <Text style={styles.summaryTileLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  finishingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.72)', alignItems: 'center', justifyContent: 'center',
  },
  finishingCard: {
    alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 24, borderRadius: 22,
    backgroundColor: '#0F172A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  finishingTitle: { color: Colors.white, fontSize: 17, fontWeight: '900' },
  finishingSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13.5, fontWeight: '600' },
  resumeCenterWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  resumeEmoji: { fontSize: 56, marginBottom: 16 },
  resumeTitle: { fontSize: 22, fontWeight: '800', color: Colors.white, marginBottom: 8, textAlign: 'center' },
  resumeSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  resumeStatsRow: { flexDirection: 'row', gap: 32, marginBottom: 36 },
  resumeStatItem: { alignItems: 'center' },
  resumeStatValue: { fontSize: 28, fontWeight: '900', color: Colors.white },
  resumeStatLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  resumePrimaryBtn: {
    width: '100%', paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  resumePrimaryBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  resumeDiscardBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  resumeDiscardBtnText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.white },

  guideBox: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  guideStep: { fontSize: 10, fontWeight: '800', color: Colors.neutral400, letterSpacing: 1.2, marginBottom: 4 },
  guideTitle: { fontSize: 16, fontWeight: '800', color: Colors.white, marginBottom: 6 },
  guideBody: { fontSize: 13, color: Colors.neutral400, lineHeight: 19 },

  pickRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 16 },
  pickTile: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  pickIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pickLabel: { fontSize: 14, fontWeight: '800', color: Colors.neutral400 },

  heroCard: { borderRadius: 24, padding: 22, marginBottom: 16, overflow: 'hidden', minHeight: 190 },
  heroGlyph: { position: 'absolute', right: -18, bottom: -22 },
  heroKicker: { fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.75)', letterSpacing: 1.6 },
  heroTitle: { fontSize: 34, fontWeight: '900', color: Colors.white, marginTop: 4 },
  heroBody: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.88)', marginTop: 6, maxWidth: '78%' },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroChipText: { fontSize: 11.5, fontWeight: '800', color: Colors.white },

  gpsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 26,
  },
  gpsSettingsBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' },
  gpsSettingsText: { fontSize: 12.5, fontWeight: '800', color: Colors.white },

  startRingWrap: { alignSelf: 'center', width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  startRingPulse: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 3 },
  startRing: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', gap: 4 },
  startRingText: { fontSize: 15, fontWeight: '900', color: Colors.white, letterSpacing: 2 },
  startHint: { textAlign: 'center', fontSize: 12.5, color: Colors.neutral500, marginTop: 14, lineHeight: 18 },

  actCard: {
    borderRadius: 18, marginBottom: 12, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
  },
  actCardInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  actCardLabel: { fontSize: 17, fontWeight: '800', marginBottom: 3 },
  actCardSub: { fontSize: 12, lineHeight: 16 },
  actCardCheck: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },

  gpsBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  gpsText: { fontSize: 13, color: Colors.neutral300, fontWeight: '600', flex: 1 },
  gpsCoord: { fontSize: 12, fontWeight: '600', color: Colors.neutral500, marginTop: 6 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 18, paddingVertical: 18,
  },
  startBtnText: { fontSize: 17, fontWeight: '900', color: Colors.white, letterSpacing: 0.3 },

  // Map phase
  mapContainer: { height: SCREEN_H * 0.42, position: 'relative' },
  mapOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  mapStatusRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  statusPillText: { fontSize: 11, fontWeight: '900', color: Colors.white, letterSpacing: 1 },
  stopTopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  stopTopText: { fontSize: 11, fontWeight: '900', color: Colors.white, letterSpacing: 1 },
  startMarker: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },

  // Metrics panel
  liveMapContainer: { flex: 1, minHeight: SCREEN_H * 0.3, position: 'relative' },
  metricsPanel: {
    backgroundColor: '#0B1220',
    marginTop: -26, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#334155', marginBottom: 8 },
  recenterBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(15,23,42,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  distBlock: { alignItems: 'center', marginBottom: 14 },
  distRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  distValue: { fontSize: 64, fontWeight: '900', color: Colors.white, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  distUnit: { fontSize: 20, fontWeight: '800', color: Colors.neutral400, marginBottom: 12, marginLeft: 6 },
  distLabel: { fontSize: 11, fontWeight: '800', color: Colors.neutral500, letterSpacing: 2, marginTop: -4 },

  primaryRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#131C2E',
    borderRadius: 18, paddingVertical: 14, marginBottom: 10,
  },
  primaryStat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  primaryValue: { fontSize: 24, fontWeight: '900', color: Colors.white, fontVariant: ['tabular-nums'] },
  primaryUnit: { fontSize: 11, fontWeight: '700', color: Colors.neutral400, marginLeft: 2, marginBottom: 4 },
  primaryLabel: { fontSize: 10, fontWeight: '800', color: Colors.neutral500, letterSpacing: 1.2, marginTop: 2 },
  primaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: '#273449' },

  statsGrid: { flexDirection: 'row', gap: 8 },
  statTile: {
    flex: 1,
    backgroundColor: '#131C2E', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  statTileLabel: { fontSize: 10, fontWeight: '700', color: Colors.neutral400, letterSpacing: 0.5 },
  statTileValue: { fontSize: 19, fontWeight: '900', color: Colors.white, marginTop: 2, fontVariant: ['tabular-nums'] },
  statTileUnit: { fontSize: 11, color: Colors.neutral500, marginTop: 1 },

  controlsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  ctrlBtn: {
    flex: 1, height: 58, borderRadius: 18, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  ctrlText: { color: Colors.white, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

  milestoneBanner: {
    position: 'absolute', top: -20, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14,
  },
  milestoneBannerText: { fontSize: 14, fontWeight: '800', color: Colors.white, flex: 1 },

  // Summary phase
  summaryMapOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 100,
  },
  summaryHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12,
  },
  actTypeBadge: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
  },
  actTypeBadgeText: { fontSize: 13, fontWeight: '900', color: Colors.white },
  summaryDate: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  greatJobBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E293B', borderRadius: 18,
    padding: 16, marginTop: 16, marginBottom: 12,
  },
  greatJobTitle: { fontSize: 18, fontWeight: '900', color: Colors.white },
  greatJobSub: { fontSize: 13, color: Colors.neutral400, marginTop: 2 },

  recordsBanner: {
    backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 18,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
  },
  recordsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  recordsTitle: { fontSize: 15, fontWeight: '900', color: '#F59E0B' },
  recordsItem: { fontSize: 13, color: Colors.white, fontWeight: '600', marginTop: 4 },

  primaryStats: {
    flexDirection: 'row', backgroundColor: '#1E293B',
    borderRadius: 18, padding: 20, marginBottom: 12, alignItems: 'center',
  },
  primaryStatItem: { flex: 1, alignItems: 'center' },
  primaryStatValue: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  primaryStatUnit: { fontSize: 12, color: Colors.neutral500, marginTop: -2 },
  primaryStatLabel: { fontSize: 12, color: Colors.neutral400, fontWeight: '700', marginTop: 4 },
  statDivider: { width: 1, height: 60, backgroundColor: '#334155' },

  secondaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  summaryTile: {
    width: (SCREEN_W - 60) / 3,
    backgroundColor: '#1E293B', borderRadius: 14, padding: 14, alignItems: 'center',
  },
  summaryTileValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  summaryTileUnit: { fontSize: 10, color: Colors.neutral500, marginTop: 1 },
  summaryTileLabel: { fontSize: 11, color: Colors.neutral400, fontWeight: '700', marginTop: 4, textAlign: 'center' },

  splitsSection: {
    backgroundColor: '#1E293B', borderRadius: 18, padding: 16, marginBottom: 16,
  },
  splitsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  splitsTitle: { fontSize: 14, fontWeight: '800', color: Colors.white },
  splitRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#334155',
  },
  splitIndex: { fontSize: 13, fontWeight: '700', color: Colors.neutral400, width: 56 },
  splitValue: { fontSize: 14, fontWeight: '800', color: Colors.white, flex: 1, textAlign: 'center' },
  splitDuration: { fontSize: 12, fontWeight: '600', color: Colors.neutral500, width: 56, textAlign: 'right' },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 18, paddingVertical: 18,
  },
  saveBtnText: { fontSize: 17, fontWeight: '900', color: Colors.white },
  visibilityLabel: { fontSize: 13, fontWeight: '700', color: Colors.neutral400, marginTop: 18, marginBottom: 8 },
  visibilityRow: { flexDirection: 'row', gap: 8 },
  templateRow: { flexDirection: 'row', gap: 10 },
  templatePill: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  templateSwatch: { width: '100%', height: 36, borderRadius: 8 },
  templatePillText: { fontSize: 12, fontWeight: '700', color: Colors.neutral400 },
  previewWrap: { alignItems: 'center', marginBottom: 14 },
  aspectRow: { flexDirection: 'row', gap: 8, marginBottom: 14, justifyContent: 'center' },
  aspectPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  aspectPillText: { fontSize: 12.5, fontWeight: '700', color: Colors.neutral400 },
  takePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 10, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  takePhotoBtnText: { fontSize: 14, fontWeight: '800' },
  photoBtnRow: { flexDirection: 'row', gap: 10 },
  photoBtnHalf: { flex: 1 },
  visibilityPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  visibilityPillText: { fontSize: 12.5, fontWeight: '700', color: Colors.neutral400 },
  shareRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  shareRowBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14,
    borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  shareRowBtnBusy: { opacity: 0.7 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, marginTop: 10,
    borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  shareBtnText: { fontSize: 15, fontWeight: '800' },
  discardBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, marginTop: 8,
  },
  discardBtnText: { fontSize: 14, fontWeight: '700', color: Colors.error },
});
