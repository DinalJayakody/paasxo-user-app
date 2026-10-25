import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play, Video as VideoIcon, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../styles/colors';
import { resolveMediaUrl } from '../utils/mediaUrl';

export interface GalleryItem {
  url: string;
  mediaType: 'IMAGE' | 'VIDEO';
  thumbnailUrl?: string | null;
}

/** Horizontal strip of a venue's / trainer's photos & videos; tap to open full screen. */
export function MediaGallery({ items, title = 'Photos & Videos' }: { items: GalleryItem[]; title?: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const list = useMemo(
    () => items
      .map((m) => ({ ...m, url: resolveMediaUrl(m.url) ?? m.url, thumbnailUrl: resolveMediaUrl(m.thumbnailUrl ?? undefined) }))
      .filter((m) => !!m.url),
    [items],
  );
  if (list.length === 0) return null;

  return (
    <View>
      <Text style={s.title}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
        {list.map((m, i) => (
          <Pressable key={m.url} onPress={() => setOpenAt(i)} style={s.thumb} accessibilityRole="imagebutton"
            accessibilityLabel={m.mediaType === 'VIDEO' ? 'Play video' : 'View photo'}>
            {m.mediaType === 'VIDEO' && !m.thumbnailUrl ? (
              <View style={[StyleSheet.absoluteFill, s.videoThumb]}>
                <VideoIcon color="rgba(255,255,255,0.8)" size={26} />
              </View>
            ) : (
              <Image source={{ uri: m.thumbnailUrl ?? m.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            )}
            {m.mediaType === 'VIDEO' && (
              <View style={s.playBadge}><Play color="#fff" size={14} fill="#fff" /></View>
            )}
          </Pressable>
        ))}
      </ScrollView>
      <GalleryViewer items={list} index={openAt} onClose={() => setOpenAt(null)} />
    </View>
  );
}

function GalleryViewer({ items, index, onClose }: { items: GalleryItem[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(0);
  const listRef = useRef<FlatList>(null);

  return (
    <Modal visible={index != null} animationType="fade" onRequestClose={onClose} statusBarTranslucent
      onShow={() => setCurrent(index ?? 0)}>
      <View style={viewer.root}>
        {index != null && (
          <FlatList
            ref={listRef}
            data={items}
            horizontal
            pagingEnabled
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(m) => m.url}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item, index: i }) => (
              <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
                {item.mediaType === 'VIDEO'
                  ? (i === current ? <GalleryVideo uri={item.url} width={width} height={height * 0.8} /> : null)
                  : <Image source={{ uri: item.url }} style={{ width, height: height * 0.8 }} resizeMode="contain" />}
              </View>
            )}
          />
        )}
        <Pressable onPress={onClose} style={[viewer.close, { top: insets.top + 12 }]} hitSlop={10}
          accessibilityRole="button" accessibilityLabel="Close">
          <X color="#fff" size={22} />
        </Pressable>
        {items.length > 1 && (
          <Text style={[viewer.counter, { bottom: insets.bottom + 24 }]}>{current + 1} / {items.length}</Text>
        )}
      </View>
    </Modal>
  );
}

/** Mounted only for the visible page, so just one video plays at a time. */
function GalleryVideo({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer({ uri }, (p) => { p.loop = true; p.play(); });
  return <VideoView player={player} style={{ width, height }} contentFit="contain" nativeControls />;
}

const viewer = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  close: {
    position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center',
  },
  counter: { position: 'absolute', alignSelf: 'center', color: '#fff', fontWeight: '700', fontSize: 13 },
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 },
  thumb: { width: 132, height: 100, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.inputBg },
  videoThumb: { backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    position: 'absolute', left: 8, bottom: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
});

/** Speciality tags (venue / trainer). */
export function SpecialityChips({ items, title = 'Specialities', accent }: { items?: string[] | null; title?: string; accent?: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => chipStyles(colors, accent ?? colors.primary), [colors, accent]);
  if (!items || items.length === 0) return null;
  return (
    <View>
      <Text style={s.title}>{title}</Text>
      <View style={s.wrap}>
        {items.map((t) => (
          <View key={t} style={s.chip}><Text style={s.text}>{t}</Text></View>
        ))}
      </View>
    </View>
  );
}

const chipStyles = (colors: ThemeColors, accent: string) => StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: accent + '18', borderWidth: 1, borderColor: accent + '33' },
  text: { fontSize: 13, fontWeight: '700', color: accent },
});
