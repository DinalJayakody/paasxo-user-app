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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import {
  ArrowLeft, Play, Pause, Square, CheckCircle,
  Navigation, Zap, TrendingUp, Wind,
  ChevronRight, Trophy, Share2, Trash2, MapPin,
  Footprints, ListOrdered,
} from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { activityStorage, activityApi, StoredActivity, ActivityType } from '../api/activityApi';
import { goBack } from '../utils/navigation';
import { useActivityTracking } from '../hooks/useActivityTracking';
import { LiveSplit, formatTime, formatDist, distUnit, formatPace, genLocalId } from '../utils/activityMath';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = 'SELECT' | 'COUNTDOWN' | 'ACTIVE' | 'PAUSED' | 'SUMMARY';
type GpsStatus = 'CHECKING' | 'READY' | 'ERROR';

// ── Activity configs ───────────────────────────────────────────────────────────
// Pace (min/km) is the only speed-like metric shown for WALK/RUN — no km/h
// anywhere for those two. CYCLING keeps km/h speed, since pace isn't a
// meaningful metric for cycling (same convention Strava/most fitness apps use).
const ACT = {
  WALK: {
    label: 'Walk',
    emoji: '🚶',
    isPaceBased: true,
    colors: ['#059669', '#047857'] as [string, string],
    accentColor: '#059669',
    guideText: 'Perfect for a relaxed outdoor stroll. Every step counts!',
  },
  RUN: {
    label: 'Run',
    emoji: '🏃',
    isPaceBased: true,
    colors: ['#DC2626', '#991B1B'] as [string, string],
    accentColor: '#DC2626',
    guideText: 'Push your limits. Stay hydrated and breathe steady!',
  },
  CYCLING: {
    label: 'Cycle',
    emoji: '🚴',
    isPaceBased: false,
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

function bestSplitPaceSecPerKm(splits: LiveSplit[]): number | null {
  const paces = splits.map((s) => s.paceSecPerKm).filter((p): p is number => p != null);
  return paces.length ? Math.min(...paces) : null;
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
      <Text style={{ fontSize: 52 }}>{ACT[type].emoji}</Text>
    </Animated.View>
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
const Countdown = ({ value, color }: { value: number; color: string }) => {
  const scale = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    scale.setValue(0.5);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 180, friction: 7 }).start();
  }, [value]);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <Animated.Text style={{ fontSize: 100, fontWeight: '900', color, transform: [{ scale }] }}>
        {value}
      </Animated.Text>
      <Text style={{ fontSize: 20, color: Colors.neutral500, fontWeight: '600', marginTop: -8 }}>
        Get ready!
      </Text>
    </View>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ActivityTrackerScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  // Phase state
  const [phase, setPhase] = useState<Phase>('SELECT');
  const [actType, setActType] = useState<ActivityType>('RUN');
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('CHECKING');
  const [countdown, setCountdown] = useState(3);
  const [currentLoc, setCurrentLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completedActivity, setCompletedActivity] = useState<StoredActivity | null>(null);

  const tracking = useActivityTracking(actType);
  const { stats } = tracking;

  const bannerY = useRef(new Animated.Value(-80)).current;
  const prevSplitCountRef = useRef(0);

  const cfg = ACT[actType];

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
    setCountdown(3);
    let count = 3;
    const cd = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(cd);
        beginTracking();
      } else {
        setCountdown(count);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actType]);

  const beginTracking = useCallback(async () => {
    prevSplitCountRef.current = 0;
    const started = await tracking.start();
    if (!started) {
      Alert.alert('Location permission needed', 'Please enable location access to track this activity.');
      setPhase('SELECT');
      return;
    }
    setPhase('ACTIVE');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pause / Resume ────────────────────────────────────────────────────────
  const handlePause = useCallback(async () => {
    await tracking.pause();
    setPhase('PAUSED');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResume = useCallback(async () => {
    await tracking.resume();
    setPhase('ACTIVE');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stop & finish ─────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    Alert.alert('Finish Activity?', 'This will end your current session.', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Finish', style: 'destructive', onPress: finishActivity },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishActivity = useCallback(async () => {
    const result = await tracking.stop();
    const last = result.route[result.route.length - 1];

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
      splits: result.splits,
      routeCoordinates: result.route,
      startLatitude: result.startLatitude,
      startLongitude: result.startLongitude,
      endLatitude: result.endLatitude,
      endLongitude: result.endLongitude,
    };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actType]);

  // ── Save activity ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!completedActivity) return;
    setSaving(true);
    await activityStorage.save(completedActivity);
    activityApi.syncToServer(completedActivity).catch(() => {});
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved!', 'Your activity has been saved to your history.', [
      { text: 'View History', onPress: () => router.replace('/activity-history' as any) },
      { text: 'Done', onPress: () => goBack(router) },
    ]);
  }, [completedActivity, router]);

  const handleShare = useCallback(async () => {
    if (!completedActivity) return;
    const { durationSeconds, distanceMeters, maxSpeedKmh: maxSp, avgSpeedKmh, avgPaceSecPerKm, elevationGainMeters, elevationLossMeters, stepCount } = completedActivity;
    const speedOrPace = actType !== 'CYCLING'
      ? `🏃 Pace: ${formatPace(avgPaceSecPerKm)} /km\n`
      : `⚡ Speed: ${avgSpeedKmh.toFixed(1)} km/h (max ${maxSp.toFixed(1)})\n`;
    const message =
      `${ACT[actType].emoji} ${ACT[actType].label} complete on Paasxo!\n\n` +
      `📍 Distance: ${formatDist(distanceMeters)} ${distUnit(distanceMeters)}\n` +
      `⏱️ Duration: ${formatTime(durationSeconds)}\n` +
      speedOrPace +
      `⛰️ Elevation: ${elevationGainMeters}m gain, ${elevationLossMeters}m loss` +
      (stepCount ? `\n👣 Steps: ${stepCount}` : '');
    try {
      await Share.share({ message });
    } catch {
      // User cancelled the share sheet or it's unsupported — no error surfaced.
    }
  }, [completedActivity, actType]);

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
          {/* Guide */}
          <View style={styles.guideBox}>
            <Text style={styles.guideStep}>STEP 1 OF 2</Text>
            <Text style={styles.guideTitle}>Choose your activity</Text>
            <Text style={styles.guideBody}>{cfg.guideText}</Text>
          </View>

          {/* Activity type cards */}
          {(['WALK', 'RUN', 'CYCLING'] as ActivityType[]).map((t) => {
            const c = ACT[t];
            const selected = actType === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => { setActType(t); Haptics.selectionAsync(); }}
                activeOpacity={0.85}
                style={[styles.actCard, selected && { borderColor: c.accentColor, borderWidth: 2.5 }]}
              >
                <LinearGradient
                  colors={selected ? c.colors : ['#1E293B', '#2D3748']}
                  style={styles.actCardInner}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Text style={{ fontSize: 36 }}>{c.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={[styles.actCardLabel, { color: selected ? Colors.white : Colors.neutral300 }]}>{c.label}</Text>
                    <Text style={[styles.actCardSub, { color: selected ? 'rgba(255,255,255,0.75)' : Colors.neutral500 }]}>{c.guideText}</Text>
                  </View>
                  {selected && (
                    <View style={[styles.actCardCheck, { backgroundColor: c.accentColor }]}>
                      <CheckCircle color={Colors.white} size={18} strokeWidth={2.5} />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}

          {/* GPS status */}
          <View style={styles.gpsBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {gpsStatus === 'READY' ? (
                <GpsDot color="#22C55E" />
              ) : gpsStatus === 'ERROR' ? (
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.error }} />
              ) : (
                <GpsDot color={Colors.warning} />
              )}
              <Text style={styles.gpsText}>
                {gpsStatus === 'READY'
                  ? 'GPS locked — ready to track!'
                  : gpsStatus === 'ERROR'
                  ? 'Location permission denied. Please enable in Settings.'
                  : 'Acquiring GPS signal…'}
              </Text>
            </View>
            {gpsStatus === 'READY' && currentLoc && (
              <Text style={styles.gpsCoord} numberOfLines={1}>
                {placeName ?? 'Current location'}
              </Text>
            )}
          </View>

          {/* Guide step 2 */}
          <View style={styles.guideBox}>
            <Text style={styles.guideStep}>STEP 2 OF 2</Text>
            <Text style={styles.guideTitle}>Start tracking</Text>
            <Text style={styles.guideBody}>
              Once GPS is locked, press the button below. A 3-second countdown will begin so you can get moving!
              Tracking keeps running in the background even if you lock your phone.
            </Text>
          </View>

          {/* Start button */}
          <TouchableOpacity
            onPress={beginCountdown}
            disabled={gpsStatus !== 'READY'}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={gpsStatus === 'READY' ? cfg.colors : ['#374151', '#374151']}
              style={[styles.startBtn, gpsStatus !== 'READY' && { opacity: 0.5 }]}
            >
              <Play color={Colors.white} size={24} strokeWidth={2.5} fill={Colors.white} />
              <Text style={styles.startBtnText}>
                {gpsStatus === 'READY' ? `Start ${cfg.label}` : 'Waiting for GPS…'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
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
        <Countdown value={countdown} color={cfg.accentColor} />
      </View>
    </View>
  );

  const renderActivePhase = (paused: boolean) => {
    const avgLabel = cfg.isPaceBased ? 'Avg Pace' : 'Avg Speed';
    const avgValue = cfg.isPaceBased ? formatPace(stats.currentPaceSecPerKm) : stats.avgSpeedKmh.toFixed(1);
    const avgUnit = cfg.isPaceBased ? 'min/km' : 'km/h';
    const currentLabel = cfg.isPaceBased ? 'Pace' : 'Speed';
    const currentValue = cfg.isPaceBased ? formatPace(stats.currentPaceSecPerKm) : stats.currentSpeedKmh.toFixed(1);
    const currentUnit = cfg.isPaceBased ? 'min/km' : 'km/h';

    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
        {/* Map */}
        <View style={styles.mapContainer}>
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
                  strokeWidth={5}
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
                <Text style={styles.statusPillText}>{paused ? 'PAUSED' : 'TRACKING'}</Text>
              </View>
              <TouchableOpacity onPress={handleStop} style={styles.stopTopBtn}>
                <Square color={Colors.white} size={16} fill={Colors.white} />
                <Text style={styles.stopTopText}>STOP</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* Metrics panel */}
        <View style={styles.metricsPanel}>
          {/* Avatar + timer */}
          <View style={styles.timerRow}>
            <Avatar type={actType} active={!paused} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.timerLabel}>TIME</Text>
              <Text style={[styles.timerValue, { color: cfg.accentColor }]}>{formatTime(stats.elapsedSeconds)}</Text>
            </View>
            <View style={styles.pauseBtn}>
              <TouchableOpacity
                onPress={paused ? handleResume : handlePause}
                style={[styles.pauseBtnInner, { backgroundColor: paused ? cfg.accentColor : '#374151' }]}
              >
                {paused
                  ? <Play color={Colors.white} size={24} fill={Colors.white} />
                  : <Pause color={Colors.white} size={24} />
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* Distance (large) */}
          <View style={styles.distRow}>
            <Text style={styles.distValue}>{formatDist(stats.distanceMeters)}</Text>
            <Text style={styles.distUnit}>{distUnit(stats.distanceMeters)}</Text>
          </View>

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <StatTile label={currentLabel} value={currentValue} unit={currentUnit} Icon={<Zap color={cfg.accentColor} size={14} />} />
            <StatTile label={avgLabel} value={avgValue} unit={avgUnit} Icon={<Wind color={cfg.accentColor} size={14} />} />
            <StatTile label="Elevation" value={`+${stats.elevationGainMeters}`} unit="m" Icon={<TrendingUp color="#8B5CF6" size={14} />} />
            <StatTile label="Steps" value={stats.stepCount != null ? `${stats.stepCount}` : '—'} unit="steps" Icon={<Footprints color="#F97316" size={14} />} />
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
      durationSeconds, distanceMeters, avgSpeedKmh, maxSpeedKmh: maxSp, avgPaceSecPerKm,
      elevationGainMeters, elevationLossMeters, stepCount, splits, routeCoordinates,
    } = completedActivity;
    const bestPace = bestSplitPaceSecPerKm(splits);

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
            {cfg.isPaceBased ? (
              <>
                <SummaryTile label="Avg Pace" value={formatPace(avgPaceSecPerKm)} unit="min/km" color="#F59E0B" />
                <SummaryTile label="Best Split" value={formatPace(bestPace)} unit="min/km" color="#3B82F6" />
              </>
            ) : (
              <>
                <SummaryTile label="Avg Speed" value={`${avgSpeedKmh.toFixed(1)}`} unit="km/h" color="#3B82F6" />
                <SummaryTile label="Max Speed" value={`${maxSp.toFixed(1)}`} unit="km/h" color="#8B5CF6" />
              </>
            )}
            <SummaryTile label="Elevation" value={`+${elevationGainMeters}`} unit={`m · -${elevationLossMeters}m`} color="#10B981" />
            <SummaryTile label="Steps" value={stepCount != null ? `${stepCount}` : '—'} unit="steps" color="#F97316" />
            <SummaryTile label="Splits" value={`${splits.length}`} unit="recorded" color="#6366F1" />
          </View>

          {/* Per-km splits */}
          {splits.length > 0 && (
            <View style={styles.splitsSection}>
              <View style={styles.splitsHeader}>
                <ListOrdered color={cfg.accentColor} size={16} />
                <Text style={styles.splitsTitle}>
                  {cfg.isPaceBased ? 'Pace per Kilometer' : 'Speed per Kilometer'}
                </Text>
              </View>
              {splits.map((s) => (
                <View key={s.index} style={styles.splitRow}>
                  <Text style={styles.splitIndex}>Km {s.index}</Text>
                  <Text style={styles.splitValue}>
                    {cfg.isPaceBased ? `${formatPace(s.paceSecPerKm)} /km` : `${s.avgSpeedKmh.toFixed(1)} km/h`}
                  </Text>
                  <Text style={styles.splitDuration}>{formatTime(s.durationSeconds)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85} style={{ marginTop: 12 }}>
            <LinearGradient colors={cfg.colors} style={styles.saveBtn}>
              <CheckCircle color={Colors.white} size={22} strokeWidth={2.5} />
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Activity'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare} activeOpacity={0.8} style={styles.shareBtn}>
            <Share2 color={cfg.accentColor} size={18} strokeWidth={2.25} />
            <Text style={[styles.shareBtnText, { color: cfg.accentColor }]}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDiscard} activeOpacity={0.8} style={styles.discardBtn}>
            <Trash2 color={Colors.error} size={18} />
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // ── Phase router ──────────────────────────────────────────────────────────
  if (phase === 'SELECT') return renderSelectPhase();
  if (phase === 'COUNTDOWN') return renderCountdownPhase();
  if (phase === 'ACTIVE') return renderActivePhase(false);
  if (phase === 'PAUSED') return renderActivePhase(true);
  if (phase === 'SUMMARY') return renderSummaryPhase();
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatTile({ label, value, unit, Icon }: { label: string; value: string; unit: string; Icon: React.ReactNode }) {
  return (
    <View style={styles.statTile}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        {Icon}
        <Text style={styles.statTileLabel}>{label}</Text>
      </View>
      <Text style={styles.statTileValue}>{value}</Text>
      <Text style={styles.statTileUnit}>{unit}</Text>
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
  mapContainer: { height: SCREEN_H * 0.48, position: 'relative' },
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
  metricsPanel: {
    flex: 1, backgroundColor: '#0F172A',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  timerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  timerLabel: { fontSize: 10, fontWeight: '800', color: Colors.neutral500, letterSpacing: 1.5 },
  timerValue: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  pauseBtn: { alignItems: 'center', justifyContent: 'center' },
  pauseBtnInner: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },

  distRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  distValue: { fontSize: 52, fontWeight: '900', color: Colors.white, letterSpacing: -2 },
  distUnit: { fontSize: 18, fontWeight: '700', color: Colors.neutral400, marginBottom: 10, marginLeft: 6 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statTile: {
    flex: 1, minWidth: '44%',
    backgroundColor: '#1E293B', borderRadius: 14,
    padding: 12,
  },
  statTileLabel: { fontSize: 10, fontWeight: '700', color: Colors.neutral400, letterSpacing: 0.5 },
  statTileValue: { fontSize: 20, fontWeight: '900', color: Colors.white, marginTop: 2 },
  statTileUnit: { fontSize: 11, color: Colors.neutral500, marginTop: 1 },

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
