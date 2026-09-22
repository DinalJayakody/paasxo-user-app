import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StoredActivity, ActivityType } from '../../api/activityApi';
import { formatTime, formatDist, distUnit, formatPace } from '../../utils/activityMath';

// 4:5 — a good universal ratio for both a feed Post and an external
// WhatsApp/Instagram share; not a perfect 9:16 Story fit but close enough to
// read cleanly there too, and this app has exactly one card design rather
// than a separate render per destination.
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;

export const ACT_META: Record<ActivityType, { emoji: string; label: string; colors: [string, string]; isPaceBased: boolean }> = {
  WALK: { emoji: '🚶', label: 'Walk', colors: ['#059669', '#047857'], isPaceBased: true },
  RUN: { emoji: '🏃', label: 'Run', colors: ['#DC2626', '#991B1B'], isPaceBased: true },
  CYCLING: { emoji: '🚴', label: 'Cycle', colors: ['#2563EB', '#1D4ED8'], isPaceBased: false },
};

interface ActivityShareCardProps {
  activity: StoredActivity;
  authorName: string;
  /** Local file:// URI from MapView.takeSnapshot(), or null to fall back to a plain gradient. */
  mapSnapshotUri?: string | null;
  /**
   * Printed directly on the card (not just carried as accompanying share
   * text) so the "view this on Paasxo" link survives regardless of which
   * app it's shared into — expo-sharing's shareAsync (used for the actual
   * external share) can't attach a text message alongside the image on
   * every platform, so baking the link into the pixels is what actually
   * guarantees it reaches WhatsApp/etc., not just a best-effort caption.
   */
  shareUrl?: string | null;
  /** Fires once the map snapshot <Image> has actually painted — the caller
   * waits for this before capturing the card, otherwise a screenshot taken
   * too early can come out with a blank map area. */
  onMapImageLoad?: () => void;
}

/**
 * Strava-style shareable summary card — captured to a flat image via
 * react-native-view-shot (see useActivityShareCard.ts) for external sharing
 * and for posting the activity as a Paasxo Story/Post. Pure presentation;
 * ref must point at the outermost View for captureRef to work.
 */
export const ActivityShareCard = React.forwardRef<View, ActivityShareCardProps>(
  ({ activity, authorName, mapSnapshotUri, shareUrl, onMapImageLoad }, ref) => {
    const meta = ACT_META[activity.type];
    const dateLabel = new Date(activity.startTime).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        {mapSnapshotUri ? (
          <Image
            source={{ uri: mapSnapshotUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={onMapImageLoad}
            onError={onMapImageLoad}
          />
        ) : (
          <LinearGradient colors={meta.colors} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['rgba(15,23,42,0.05)', 'rgba(15,23,42,0.35)', 'rgba(15,23,42,0.92)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>PAASXO</Text>
          <View style={[styles.typeBadge, { backgroundColor: meta.colors[0] }]}>
            <Text style={styles.typeBadgeText}>{meta.emoji}  {meta.label.toUpperCase()}</Text>
          </View>
        </View>

        {/* Stats block */}
        <View style={styles.footer}>
          <Text style={styles.authorLine} numberOfLines={1}>{authorName} · {dateLabel}</Text>

          <View style={styles.mainStatsRow}>
            <View style={styles.mainStat}>
              <Text style={styles.mainStatValue}>
                {formatDist(activity.distanceMeters)}
                <Text style={styles.mainStatUnit}> {distUnit(activity.distanceMeters)}</Text>
              </Text>
              <Text style={styles.mainStatLabel}>Distance</Text>
            </View>
            <View style={styles.mainStat}>
              <Text style={styles.mainStatValue}>{formatTime(activity.durationSeconds)}</Text>
              <Text style={styles.mainStatLabel}>Duration</Text>
            </View>
          </View>

          <View style={styles.chipsRow}>
            <StatChip
              label={meta.isPaceBased ? 'Avg Pace' : 'Avg Speed'}
              value={meta.isPaceBased ? `${formatPace(activity.avgPaceSecPerKm)}/km` : `${activity.avgSpeedKmh.toFixed(1)} km/h`}
            />
            <StatChip label="Elevation" value={`+${Math.round(activity.elevationGainMeters)}m`} />
            {activity.calories != null && <StatChip label="Calories" value={`${activity.calories} kcal`} />}
          </View>

          <View style={styles.ctaRow}>
            <View style={styles.ctaDot} />
            <Text style={styles.cta} numberOfLines={1}>
              {shareUrl ? shareUrl.replace(/^https?:\/\//, '') : 'View this activity on Paasxo'}
            </Text>
          </View>
        </View>
      </View>
    );
  }
);

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  header: {
    position: 'absolute', top: 56, left: 56, right: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  wordmark: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  typeBadge: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 30 },
  typeBadgeText: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

  footer: { position: 'absolute', left: 56, right: 56, bottom: 56 },
  authorLine: { fontSize: 24, fontWeight: '700', color: 'rgba(255,255,255,0.75)', marginBottom: 18 },

  mainStatsRow: { flexDirection: 'row', gap: 56, marginBottom: 24 },
  mainStat: {},
  mainStatValue: { fontSize: 72, fontWeight: '900', color: '#fff', letterSpacing: -1.5 },
  mainStatUnit: { fontSize: 28, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  mainStatLabel: { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  chipsRow: { flexDirection: 'row', gap: 14, marginBottom: 30 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 12,
  },
  chipValue: { fontSize: 24, fontWeight: '900', color: '#fff' },
  chipLabel: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctaDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  cta: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
});
