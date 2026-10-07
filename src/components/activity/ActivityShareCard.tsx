import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StoredActivity, ActivityType } from '../../api/activityApi';
import { formatTime, formatDist, distUnit, formatPace } from '../../utils/activityMath';

// Two supported canvas sizes shared by every template below: 'post' (4:5)
// reads cleanly in-feed and for a general external share, while 'story'
// (9:16) matches the actual Instagram/WhatsApp/Facebook Story canvas
// instead of being letterboxed into it.
export type ShareCardAspectRatio = 'post' | 'story';

export const SHARE_CARD_DIMENSIONS: Record<ShareCardAspectRatio, { width: number; height: number }> = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

// Back-compat for existing callers that just want "the" card size (the Post
// destination's — the original, and still the default aspect ratio below).
export const SHARE_CARD_WIDTH = SHARE_CARD_DIMENSIONS.post.width;
export const SHARE_CARD_HEIGHT = SHARE_CARD_DIMENSIONS.post.height;

export const ACT_META: Record<ActivityType, { emoji: string; label: string; colors: [string, string] }> = {
  WALK: { emoji: '🚶', label: 'Walk', colors: ['#059669', '#047857'] },
  RUN: { emoji: '🏃', label: 'Run', colors: ['#DC2626', '#991B1B'] },
  CYCLING: { emoji: '🚴', label: 'Cycle', colors: ['#2563EB', '#1D4ED8'] },
};

// ── Templates ────────────────────────────────────────────────────────────
// Genuinely different looks sharing the same underlying stats, so picking
// one is a style choice, not a data choice. 'classic' is the original
// design and stays the default for every existing caller.
export type ShareCardTemplateId = 'classic' | 'minimal' | 'bold' | 'mapview' | 'photo';

export const SHARE_CARD_TEMPLATES: { id: ShareCardTemplateId; label: string; previewColors: [string, string] }[] = [
  { id: 'classic', label: 'Classic', previewColors: ['#0F172A', '#1E293B'] },
  { id: 'minimal', label: 'Minimal', previewColors: ['#F8FAFC', '#CBD5E1'] },
  { id: 'bold', label: 'Bold', previewColors: ['#DC2626', '#991B1B'] },
  { id: 'mapview', label: 'Map View', previewColors: ['#1E3A8A', '#0C4A6E'] },
  { id: 'photo', label: 'Photo', previewColors: ['#78350F', '#451A03'] },
];

// Templates whose background is the route map (need a MapView snapshot) vs
// a user-taken photo — useActivityShareCard.ts uses this to decide whether
// to bother taking a map snapshot at all for a given template.
export function templateUsesMap(id: ShareCardTemplateId): boolean {
  return id === 'classic' || id === 'minimal' || id === 'mapview';
}
export function templateUsesPhoto(id: ShareCardTemplateId): boolean {
  return id === 'photo';
}

interface ActivityShareCardProps {
  activity: StoredActivity;
  authorName: string;
  /** Local file:// URI from MapView.takeSnapshot(), or null to fall back to a plain gradient. */
  mapSnapshotUri?: string | null;
  /** Local file:// URI of a user-taken photo/selfie — background for the
   * 'photo' template (see templateUsesPhoto). Ignored by every other template. */
  photoUri?: string | null;
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
  /** Visual style — see SHARE_CARD_TEMPLATES. Defaults to the original design. */
  template?: ShareCardTemplateId;
}

/**
 * Shareable summary card — captured to a flat image via react-native-view-shot
 * (see useActivityShareCard.ts) for external sharing and for posting the
 * activity as a Paasxo Story/Post. Pure presentation; ref must point at the
 * outermost View for captureRef to work. Renders one of three templates
 * (see SHARE_CARD_TEMPLATES) off the same activity data.
 */
export const ActivityShareCard = React.forwardRef<View, ActivityShareCardProps>(
  ({ activity, authorName, mapSnapshotUri, photoUri, shareUrl, onMapImageLoad, aspectRatio = 'post', records = [], template = 'classic' }, ref) => {
    const meta = ACT_META[activity.type];
    const dim = SHARE_CARD_DIMENSIONS[aspectRatio];
    const dateLabel = new Date(activity.startTime).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });

    // Up to the first 8 km splits, scaled so the fastest bar reads tallest —
    // a compact version of the same per-km breakdown ActivityHistoryScreen
    // shows in full. Shared across templates that choose to show it.
    const paceSplits = activity.splits.filter((s) => s.paceSecPerKm != null).slice(0, 8);
    const splitPaces = paceSplits.map((s) => s.paceSecPerKm as number);
    const minSplitPace = splitPaces.length > 0 ? Math.min(...splitPaces) : 0;
    const maxSplitPace = splitPaces.length > 0 ? Math.max(...splitPaces) : 0;

    const ctaText = shareUrl ? shareUrl.replace(/^https?:\/\//, '') : 'View this activity on Paasxo';

    const mapImage = mapSnapshotUri ? (
      <Image
        source={{ uri: mapSnapshotUri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={onMapImageLoad}
        onError={onMapImageLoad}
      />
    ) : null;

    // 'photo' uses the exact same background-image mechanics as the map
    // templates (same onLoad/onError wait-for-paint contract the capture
    // pipeline already relies on) — just a different source.
    const photoImage = photoUri ? (
      <Image
        source={{ uri: photoUri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={onMapImageLoad}
        onError={onMapImageLoad}
      />
    ) : null;

    if (template === 'mapview') {
      return (
        <View ref={ref} collapsable={false} style={[styles.card, { width: dim.width, height: dim.height, backgroundColor: '#0F172A' }]}>
          {mapImage ?? <LinearGradient colors={meta.colors} style={StyleSheet.absoluteFill} />}
          {/* Only the bottom strip is darkened — the rest of the map (roads,
              landmarks, place labels) stays fully legible, unlike 'classic'
              which vignettes the whole frame. */}
          <LinearGradient
            colors={['transparent', 'rgba(15,23,42,0.75)', 'rgba(15,23,42,0.96)']}
            locations={[0, 0.6, 1]}
            style={mapview.bottomScrim}
          />

          <View style={mapview.header}>
            <Text style={mapview.wordmark}>PAASXO</Text>
            <View style={[mapview.typeBadge, { backgroundColor: meta.colors[0] }]}>
              <Text style={mapview.typeBadgeText}>{meta.emoji}  {meta.label.toUpperCase()}</Text>
            </View>
          </View>

          {records.length > 0 && (
            <View style={mapview.prBadge}>
              <Text style={mapview.prBadgeText} numberOfLines={1}>
                🏆 {records.length > 1 ? `${records.length} NEW RECORDS` : 'NEW PERSONAL RECORD'}
              </Text>
            </View>
          )}

          <View style={mapview.footer}>
            <Text style={mapview.authorLine} numberOfLines={1}>{authorName} · {dateLabel}</Text>
            <View style={mapview.statsRow}>
              <View style={mapview.stat}>
                <Text style={mapview.statValue}>{formatDist(activity.distanceMeters)}<Text style={mapview.statUnit}> {distUnit(activity.distanceMeters)}</Text></Text>
                <Text style={mapview.statLabel}>Distance</Text>
              </View>
              <View style={mapview.statDivider} />
              <View style={mapview.stat}>
                <Text style={mapview.statValue}>{formatTime(activity.durationSeconds)}</Text>
                <Text style={mapview.statLabel}>Duration</Text>
              </View>
              <View style={mapview.statDivider} />
              <View style={mapview.stat}>
                <Text style={mapview.statValue}>{formatPace(activity.avgPaceSecPerKm)}</Text>
                <Text style={mapview.statLabel}>Pace /km</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (template === 'minimal') {
      return (
        <View ref={ref} collapsable={false} style={[styles.card, { width: dim.width, height: dim.height, backgroundColor: '#F8FAFC' }]}>
          <View style={minimal.mapFrame}>
            {mapImage ?? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#E2E8F0' }]} />}
          </View>

          <View style={minimal.header}>
            <Text style={minimal.wordmark}>PAASXO</Text>
            <View style={[minimal.typeBadge, { backgroundColor: meta.colors[0] + '1A' }]}>
              <Text style={[minimal.typeBadgeText, { color: meta.colors[0] }]}>{meta.emoji}  {meta.label.toUpperCase()}</Text>
            </View>
          </View>

          {records.length > 0 && (
            <View style={minimal.prBadge}>
              <Text style={minimal.prBadgeText} numberOfLines={1}>
                🏆 {records.length > 1 ? `${records.length} NEW RECORDS` : 'NEW PERSONAL RECORD'}
              </Text>
            </View>
          )}

          <View style={minimal.footer}>
            <Text style={minimal.authorLine} numberOfLines={1}>{authorName} · {dateLabel}</Text>

            <View style={minimal.mainStatsRow}>
              <View>
                <Text style={[minimal.mainStatValue, { color: meta.colors[0] }]}>
                  {formatDist(activity.distanceMeters)}
                  <Text style={minimal.mainStatUnit}> {distUnit(activity.distanceMeters)}</Text>
                </Text>
                <Text style={minimal.mainStatLabel}>Distance</Text>
              </View>
              <View>
                <Text style={minimal.mainStatValue}>{formatTime(activity.durationSeconds)}</Text>
                <Text style={minimal.mainStatLabel}>Duration</Text>
              </View>
            </View>

            <View style={minimal.chipsRow}>
              <MinimalChip label="Avg Pace" value={`${formatPace(activity.avgPaceSecPerKm)}/km`} />
              <MinimalChip label="Elevation" value={`+${Math.round(activity.elevationGainMeters)}m`} />
              {activity.calories != null && <MinimalChip label="Calories" value={`${activity.calories} kcal`} />}
            </View>

            <View style={minimal.ctaRow}>
              <View style={[minimal.ctaDot, { backgroundColor: meta.colors[0] }]} />
              <Text style={minimal.cta} numberOfLines={1}>{ctaText}</Text>
            </View>
          </View>
        </View>
      );
    }

    if (template === 'bold') {
      return (
        <View ref={ref} collapsable={false} style={[styles.card, { width: dim.width, height: dim.height }]}>
          <LinearGradient colors={meta.colors} style={StyleSheet.absoluteFill} />
          <Text style={bold.watermarkEmoji}>{meta.emoji}</Text>

          <View style={bold.header}>
            <Text style={bold.wordmark}>PAASXO</Text>
            {records.length > 0 && (
              <View style={bold.prBadge}>
                <Text style={bold.prBadgeText} numberOfLines={1}>
                  🏆 {records.length > 1 ? `${records.length} NEW RECORDS` : 'PERSONAL RECORD'}
                </Text>
              </View>
            )}
          </View>

          <View style={bold.center}>
            <Text style={bold.typeLabel}>{meta.label.toUpperCase()}</Text>
            <Text style={bold.giantValue}>
              {formatDist(activity.distanceMeters)}
              <Text style={bold.giantUnit}>{distUnit(activity.distanceMeters)}</Text>
            </Text>
            <View style={bold.subStatsRow}>
              <Text style={bold.subStat}>{formatTime(activity.durationSeconds)}</Text>
              <View style={bold.subStatDivider} />
              <Text style={bold.subStat}>{formatPace(activity.avgPaceSecPerKm)}/km</Text>
              {activity.calories != null && (
                <>
                  <View style={bold.subStatDivider} />
                  <Text style={bold.subStat}>{activity.calories} kcal</Text>
                </>
              )}
            </View>
          </View>

          <View style={bold.footer}>
            <Text style={bold.authorLine} numberOfLines={1}>{authorName} · {dateLabel}</Text>
            <Text style={bold.cta} numberOfLines={1}>{ctaText}</Text>
          </View>
        </View>
      );
    }

    // ── 'classic' (default) / 'photo' ────────────────────────────────────
    // 'photo' is this exact same layout with a user-taken photo as the
    // background instead of the route map — Strava's "overlay your stats on
    // a photo" style. Falls back to the map (or the plain gradient) if the
    // user backs out of the camera without taking one.
    const background = template === 'photo' ? (photoImage ?? mapImage) : mapImage;
    return (
      <View ref={ref} collapsable={false} style={[styles.card, { width: dim.width, height: dim.height }]}>
        {background ?? <LinearGradient colors={meta.colors} style={StyleSheet.absoluteFill} />}
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
            <StatChip label="Avg Pace" value={`${formatPace(activity.avgPaceSecPerKm)}/km`} />
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
            <Text style={styles.cta} numberOfLines={1}>{ctaText}</Text>
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

function MinimalChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={minimal.chip}>
      <Text style={minimal.chipValue}>{value}</Text>
      <Text style={minimal.chipLabel}>{label}</Text>
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

// 'minimal' — light card, map shown as a framed inset rather than full-bleed,
// dark text, accent color pulled from the activity type.
const minimal = StyleSheet.create({
  mapFrame: {
    position: 'absolute', top: 160, left: 56, right: 56, height: 480,
    borderRadius: 32, overflow: 'hidden', backgroundColor: '#E2E8F0',
  },
  header: {
    position: 'absolute', top: 56, left: 56, right: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  wordmark: { fontSize: 34, fontWeight: '900', color: '#0F172A', letterSpacing: 2 },
  typeBadge: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 30 },
  typeBadgeText: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },

  prBadge: {
    position: 'absolute', top: 650, left: 56,
    backgroundColor: '#FEF3C7', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  prBadgeText: { fontSize: 16, fontWeight: '900', color: '#92400E', letterSpacing: 0.5 },

  footer: { position: 'absolute', left: 56, right: 56, bottom: 56 },
  authorLine: { fontSize: 22, fontWeight: '700', color: '#64748B', marginBottom: 20 },

  mainStatsRow: { flexDirection: 'row', gap: 56, marginBottom: 28 },
  mainStatValue: { fontSize: 68, fontWeight: '900', color: '#0F172A', letterSpacing: -1.5 },
  mainStatUnit: { fontSize: 26, fontWeight: '800', color: '#64748B' },
  mainStatLabel: { fontSize: 18, fontWeight: '700', color: '#94A3B8', marginTop: 2 },

  chipsRow: { flexDirection: 'row', gap: 12, marginBottom: 32, flexWrap: 'wrap' },
  chip: {
    backgroundColor: '#F1F5F9', borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 12,
  },
  chipValue: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  chipLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 2 },

  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctaDot: { width: 8, height: 8, borderRadius: 4 },
  cta: { fontSize: 17, fontWeight: '700', color: '#475569' },
});

// 'bold' — no map, solid activity-color gradient, one giant headline stat
// (poster/year-in-review style), minimal secondary chrome.
const bold = StyleSheet.create({
  watermarkEmoji: {
    position: 'absolute', right: -40, bottom: -60,
    fontSize: 420, opacity: 0.12,
  },
  header: {
    position: 'absolute', top: 56, left: 56, right: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  wordmark: { fontSize: 32, fontWeight: '900', color: 'rgba(255,255,255,0.9)', letterSpacing: 2 },
  prBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  prBadgeText: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 24, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 4, marginBottom: 8 },
  giantValue: { fontSize: 140, fontWeight: '900', color: '#fff', letterSpacing: -4 },
  giantUnit: { fontSize: 44, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },

  subStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 24 },
  subStat: { fontSize: 26, fontWeight: '800', color: '#fff' },
  subStatDivider: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },

  footer: { position: 'absolute', left: 56, right: 56, bottom: 56, alignItems: 'center' },
  authorLine: { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  cta: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.65)' },
});

// 'mapview' — map-dominant, near-full visibility of roads/landmarks/terrain;
// only a thin bottom strip is darkened for the compact stats bar, unlike
// 'classic' which vignettes the whole frame.
const mapview = StyleSheet.create({
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%' },
  header: {
    position: 'absolute', top: 56, left: 56, right: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  wordmark: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: 2, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 8 },
  typeBadge: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 30 },
  typeBadgeText: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

  prBadge: {
    position: 'absolute', top: 140, left: 56,
    backgroundColor: '#F59E0B', borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  prBadgeText: { fontSize: 18, fontWeight: '900', color: '#1A1A2E', letterSpacing: 0.5 },

  footer: { position: 'absolute', left: 56, right: 56, bottom: 48 },
  authorLine: { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.75)', marginBottom: 14 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1 },
  statValue: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  statUnit: { fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  statLabel: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 16 },
});
