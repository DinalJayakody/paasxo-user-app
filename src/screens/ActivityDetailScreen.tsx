import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import {
  ArrowLeft, Clock, Flame, TrendingUp, Wind, Zap,
  MapPin, Calendar, Trash2, Share2, Trophy,
} from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { activityStorage, StoredActivity } from '../api/activityApi';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const ACT_CFG = {
  WALK: { label: 'Walk', emoji: '🚶', colors: ['#059669', '#047857'] as [string, string], accent: '#059669' },
  RUN:  { label: 'Run',  emoji: '🏃', colors: ['#DC2626', '#991B1B'] as [string, string], accent: '#DC2626' },
  CYCLING: { label: 'Cycle', emoji: '🚴', colors: ['#2563EB', '#1D4ED8'] as [string, string], accent: '#2563EB' },
};

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

function calcPace(distM: number, secs: number): string {
  if (distM < 50 || secs < 5) return '--:--';
  const minPerKm = secs / 60 / (distM / 1000);
  const pMin = Math.floor(minPerKm);
  const pSec = Math.round((minPerKm - pMin) * 60);
  return `${pMin}:${String(pSec).padStart(2, '0')}`;
}

export default function ActivityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activity, setActivity] = useState<StoredActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

  // Stagger animation refs
  const headerAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const mapAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      if (!id) return;
      const a = await activityStorage.getById(id);
      setActivity(a);
      setLoading(false);
      if (a) {
        Animated.stagger(120, [
          Animated.timing(mapAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(statsAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();

        // Fit map to route
        if (a.routeCoordinates.length > 1) {
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(a.routeCoordinates, {
              edgePadding: { top: 50, right: 40, bottom: 50, left: 40 },
              animated: false,
            });
          }, 800);
        }
      }
    })();
  }, [id]);

  const handleDelete = () => {
    Alert.alert('Delete Activity', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!activity) return;
          await activityStorage.delete(activity.localId);
          router.back();
        }
      },
    ]);
  };

  if (loading || !activity) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <Text style={{ color: Colors.neutral400, fontSize: 16 }}>
          {loading ? 'Loading…' : 'Activity not found.'}
        </Text>
      </SafeAreaView>
    );
  }

  const cfg = ACT_CFG[activity.type];
  const pace = calcPace(activity.distanceMeters, activity.durationSeconds);
  const startDate = new Date(activity.startTime);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={20} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>{activity.title}</Text>
          <View style={styles.headerMeta}>
            <Calendar color={Colors.neutral500} size={12} />
            <Text style={styles.headerDate}>
              {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}
              {startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Trash2 color={Colors.error} size={18} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Route map */}
        <Animated.View style={[styles.mapCard, { opacity: mapAnim, transform: [{ scale: mapAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]}>
          {activity.routeCoordinates.length > 1 ? (
            <MapView
              ref={mapRef}
              provider={PROVIDER_DEFAULT}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: activity.startLatitude,
                longitude: activity.startLongitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation={false}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Polyline
                coordinates={activity.routeCoordinates}
                strokeColor={cfg.accent}
                strokeWidth={5}
                lineCap="round"
              />
              <Marker coordinate={activity.routeCoordinates[0]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.routeMarker, { backgroundColor: '#22C55E' }]}>
                  <Text style={styles.routeMarkerText}>S</Text>
                </View>
              </Marker>
              <Marker coordinate={activity.routeCoordinates[activity.routeCoordinates.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.routeMarker, { backgroundColor: Colors.error }]}>
                  <Text style={styles.routeMarkerText}>F</Text>
                </View>
              </Marker>
            </MapView>
          ) : (
            <LinearGradient colors={['#1E293B', '#0F172A']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <MapPin color={cfg.accent} size={36} />
              <Text style={{ color: Colors.neutral400, marginTop: 10, fontWeight: '600' }}>No route data recorded</Text>
            </LinearGradient>
          )}

          {/* Route map overlay badge */}
          <View style={[styles.routeTypeBadge, { backgroundColor: cfg.accent }]}>
            <Text style={{ fontSize: 16 }}>{cfg.emoji}</Text>
            <Text style={styles.routeTypeBadgeText}>{cfg.label}</Text>
          </View>
        </Animated.View>

        {/* Primary stats */}
        <Animated.View style={[styles.section, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <View style={styles.primaryRow}>
            <View style={styles.primaryStat}>
              <Text style={[styles.primaryValue, { color: cfg.accent }]}>{formatDist(activity.distanceMeters)}</Text>
              <Text style={styles.primaryLabel}>Distance</Text>
            </View>
            <View style={styles.primaryDivider} />
            <View style={styles.primaryStat}>
              <Text style={[styles.primaryValue, { color: cfg.accent }]}>{formatTime(activity.durationSeconds)}</Text>
              <Text style={styles.primaryLabel}>Duration</Text>
            </View>
          </View>
        </Animated.View>

        {/* Secondary stats grid */}
        <Animated.View style={[styles.section, { opacity: statsAnim, transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <Text style={styles.sectionTitle}>Stats Breakdown</Text>
          <View style={styles.statsGrid}>
            <DetailTile icon={<Zap color={cfg.accent} size={18} />} label="Avg Speed" value={`${activity.avgSpeedKmh.toFixed(1)}`} unit="km/h" />
            <DetailTile icon={<Wind color="#8B5CF6" size={18} />} label="Max Speed" value={`${activity.maxSpeedKmh.toFixed(1)}`} unit="km/h" />
            <DetailTile icon={<Clock color="#F59E0B" size={18} />} label="Pace" value={pace} unit="min/km" />
            <DetailTile icon={<Flame color="#EF4444" size={18} />} label="Calories" value={`${activity.estimatedCalories}`} unit="kcal" />
            <DetailTile icon={<TrendingUp color="#10B981" size={18} />} label="Elevation" value={`${activity.elevationGainMeters}`} unit="m gain" />
            <DetailTile icon={<Trophy color="#F59E0B" size={18} />} label="Route Points" value={`${activity.routeCoordinates.length}`} unit="tracked" />
          </View>
        </Animated.View>

        {/* Route info */}
        {(activity.startLatitude !== 0 || activity.startLongitude !== 0) && (
          <Animated.View style={[styles.section, { opacity: statsAnim }]}>
            <Text style={styles.sectionTitle}>Location Details</Text>
            <View style={styles.locationCard}>
              <View style={styles.locationRow}>
                <View style={[styles.locationDot, { backgroundColor: '#22C55E' }]} />
                <Text style={styles.locationLabel}>Start</Text>
                <Text style={styles.locationCoord}>
                  {activity.startLatitude.toFixed(5)}, {activity.startLongitude.toFixed(5)}
                </Text>
              </View>
              {activity.endLatitude && activity.endLongitude && (
                <View style={styles.locationRow}>
                  <View style={[styles.locationDot, { backgroundColor: Colors.error }]} />
                  <Text style={styles.locationLabel}>Finish</Text>
                  <Text style={styles.locationCoord}>
                    {activity.endLatitude.toFixed(5)}, {activity.endLongitude.toFixed(5)}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailTile({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit: string }) {
  return (
    <View style={styles.detailTile}>
      <View style={styles.detailTileIcon}>{icon}</View>
      <Text style={styles.detailTileValue}>{value}</Text>
      <Text style={styles.detailTileUnit}>{unit}</Text>
      <Text style={styles.detailTileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: Colors.white },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  headerDate: { fontSize: 11, color: Colors.neutral500, fontWeight: '600' },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  mapCard: {
    height: SCREEN_H * 0.38, marginHorizontal: 16, marginTop: 8,
    borderRadius: 20, overflow: 'hidden', backgroundColor: '#1E293B',
  },
  routeMarker: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  routeMarkerText: { fontSize: 9, fontWeight: '900', color: Colors.white },
  routeTypeBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  routeTypeBadgeText: { fontSize: 13, fontWeight: '900', color: Colors.white },

  section: { marginHorizontal: 16, marginTop: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.neutral400, letterSpacing: 0.5, marginBottom: 12 },

  primaryRow: {
    flexDirection: 'row', backgroundColor: '#1E293B',
    borderRadius: 20, padding: 20, alignItems: 'center',
  },
  primaryStat: { flex: 1, alignItems: 'center' },
  primaryValue: { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  primaryLabel: { fontSize: 12, color: Colors.neutral400, fontWeight: '700', marginTop: 4 },
  primaryDivider: { width: 1, height: 60, backgroundColor: '#334155' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailTile: {
    width: (SCREEN_W - 52) / 3,
    backgroundColor: '#1E293B', borderRadius: 16, padding: 14, alignItems: 'center',
  },
  detailTileIcon: { marginBottom: 8 },
  detailTileValue: { fontSize: 18, fontWeight: '900', color: Colors.white },
  detailTileUnit: { fontSize: 10, color: Colors.neutral500, marginTop: 2 },
  detailTileLabel: { fontSize: 11, color: Colors.neutral400, fontWeight: '700', marginTop: 5, textAlign: 'center' },

  locationCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 16 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  locationDot: { width: 10, height: 10, borderRadius: 5 },
  locationLabel: { fontSize: 13, fontWeight: '700', color: Colors.neutral300, width: 44 },
  locationCoord: { flex: 1, fontSize: 12, color: Colors.neutral500 },
});
