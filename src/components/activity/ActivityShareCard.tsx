import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StoredActivity, ActivityType } from '../../api/activityApi';
import { formatTime, formatDist, distUnit, formatPace } from '../../utils/activityMath';

// Two supported canvas sizes sharing one card design: 'post' (4:5) reads
// cleanly in-feed and for a general external share, while 'story' (9:16)
// matches the actual Instagram/WhatsApp/Facebook Story canvas instead of
// being letterboxed into it.
export type ShareCardAspectRatio = 'post' | 'story';

export const SHARE_CARD_DIMENSIONS: Record<ShareCardAspectRatio, { width: number; height: number }> = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

// Back-compat for existing callers that just want "the" card size (the Post
// destination's — the original, and still the default aspect ratio below).
export const SHARE_CARD_WIDTH = SHARE_CARD_DIMENSIONS.post.width;
export const SHARE_CARD_HEIGHT = SHARE_CARD_DIMENSIONS.post.height;

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
  /** 'post' (4:5, default) for feed/external, 'story' (9:16) for Stories. */
  aspectRatio?: ShareCardAspectRatio;
  /** Personal-record messages for this activity (see ActivityTrackerScreen's
   * finishActivity) — when non-empty, shows a trophy ribbon on the card. */
  records?: string[];
}

/**
 * Strava-style shareable summary card — captured to a flat image via
 * react-native-view-shot (see useActivityShareCard.ts) for external sharing
 * and for posting the activity as a Paasxo Story/Post. Pure presentation;
 * ref must point at the outermost View for captureRef to work.
 */
export const ActivityShareCard = React.forwardRef<View, ActivityShareCardProps>(
  ({ activity, authorName, mapSnapshotUri, shareUrl, onMapImageLoad, aspectRatio = 'post', records = [] }, ref) => {
    const meta = ACT_META[activity.type];
    const dim = SHARE_CARD_DIMENSIONS[aspectRatio];
    const dateLabel = new Date(activity.startTime).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    // Up to the first 8 km splits, scaled so the fastest bar reads tallest —
    // a compact version of the same per-km breakdown ActivityHistoryScreen
    // shows in full, kept to pace-based activities only (CYCLING has no
    // meaningful "pace" split).
    const paceSplits = meta.isPaceBased
      ? activity.splits.filter((s) => s.paceSecPerKm != null).slice(0, 8)
      : [];
    const splitPaces = paceSplits.map((s) => s.paceSecPerKm as number);
    const minSplitPace = splitPaces.length > 0 ? Math.min(...splitPaces) : 0;
    const maxSplitPace = splitPaces.length > 0 ? Math.max(...splitPaces) : 0;

    return (
      <View ref={ref} collapsable={false} style={[styles.card, { width: dim.width, height: dim.height }]}>
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

        {records.length > 0 && (
          <View style={styles.prBadge}>
            <Text style={styles.prBadgeText} numberOfLines={1}>
              🏆 {records.length > 1 ? `${records.length} NEW RECORDS` : 'NEW PERSONAL RECORD'}
            </Text>
          </View>
        )}

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

          {paceSplits.length > 1 && (
            <View style={styles.splitsBlock}>
              <Text style={styles.splitsLabel}>SPLITS</Text>
              <View style={styles.splitsRow}>
                {paceSplits.map((s) => {
                  const pace = s.paceSecPerKm as number;
                  const range = maxSplitPace - minSplitPace;
                  // Faster (lower pace) reads as a taller bar, like a
                  // performance chart — clamped to a 35–100% range so even
                  // the slowest km still renders a visible bar.
                  const heightPct = range > 0 ? 100 - ((pace - minSplitPace) / range) * 65 : 100;
                  const isBest = pace === minSplitPace;
                  return (
                    <View key={s.index} style={styles.splitBarWrap}>
                      <View style={styles.splitBarTrack}>
                        <View
                          style={[
                            styles.splitBar,
                            { height: `${heightPct}%`, backgroundColor: isBest ? '#22C55E' : 'rgba(255,255,255,0.35)' },
                          ]}
                        />
                      </View>
                      <Text style={styles.splitBarLabel}>{s.index}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

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

  prBadge: {
    position: 'absolute', top: 140, left: 56,
    backgroundColor: '#F59E0B', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  prBadgeText: { fontSize: 18, fontWeight: '900', color: '#1A1A2E', letterSpacing: 0.5 },

  splitsBlock: { marginBottom: 24 },
  splitsLabel: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 10 },
  splitsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 90 },
  splitBarWrap: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  splitBarTrack: { width: '100%', height: 68, justifyContent: 'flex-end' },
  splitBar: { width: '100%', borderRadius: 6, minHeight: 6 },
  splitBarLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)', marginTop: 6 },

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
