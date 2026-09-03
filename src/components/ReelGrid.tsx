import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Eye, Heart, Play } from 'lucide-react-native';
import { Colors, ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { ReelSummary } from '../types/api';
import { parseMediaUrl } from '../utils/postFormat';
import { ReelPlayer } from './ReelPlayer';

// Shared "grid of reel thumbnails with a live like/view badge, tap -> full
// screen player" component, parallel to PostGrid's tile layout.

interface ReelGridProps {
  reels: ReelSummary[];
  /** Auto-opens this reel once it's present in `reels` - used for deep links
   * from a "liked your reel" notification. Consumed only once. */
  autoOpenReelId?: string | null;
}

function ReelTile({ reel, onPress, styles }: { reel: ReelSummary; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  const thumbUri = parseMediaUrl(reel.thumbnailUrl);

  return (
    <View style={styles.tileWrap}>
      <Pressable style={styles.tile} onPress={onPress}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.tileImage} />
        ) : (
          <View style={[styles.tileImage, styles.tilePlaceholder]}>
            <Text style={styles.tilePlaceholderText} numberOfLines={3}>{reel.caption || 'Reel'}</Text>
          </View>
        )}
        <View style={styles.playBadge}>
          <Play color={Colors.white} size={22} strokeWidth={2.5} fill={Colors.white} />
        </View>
        <View style={styles.tileMeta}>
          <Heart color={Colors.white} size={11} strokeWidth={2} fill={Colors.white} />
          <Text style={styles.tileMetaText}>{reel.likeCount}</Text>
          <Eye color={Colors.white} size={11} strokeWidth={2} />
          <Text style={styles.tileMetaText}>{reel.viewCount}</Text>
        </View>
      </Pressable>
    </View>
  );
}

export function ReelGrid({ reels, autoOpenReelId }: ReelGridProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);
  const selectedReel = reels.find((r) => r.id === selectedReelId) ?? null;

  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!autoOpenReelId || autoOpenedRef.current) return;
    if (reels.some((r) => r.id === autoOpenReelId)) {
      autoOpenedRef.current = true;
      setSelectedReelId(autoOpenReelId);
    }
  }, [autoOpenReelId, reels]);

  return (
    <>
      <View style={styles.grid}>
        {reels.map((reel) => (
          <ReelTile key={reel.id} reel={reel} onPress={() => setSelectedReelId(reel.id)} styles={styles} />
        ))}
      </View>

      <ReelPlayer visible={!!selectedReel} reel={selectedReel} onClose={() => setSelectedReelId(null)} />
    </>
  );
}

const NUM_COLUMNS = 3;
const TILE_GAP = 3;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tileWrap: {
    width: `${100 / NUM_COLUMNS}%`,
    padding: TILE_GAP,
  },
  tile: {
    aspectRatio: 9 / 16,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.neutral100,
  },
  tileImage: { width: '100%', height: '100%' },
  tilePlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  tilePlaceholderText: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  playBadge: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -14, marginLeft: -14,
    opacity: 0.9,
  },
  tileMeta: {
    position: 'absolute', bottom: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  tileMetaText: { fontSize: 11, fontWeight: '700', color: colors.white },
});
