import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ImageOff, WifiOff } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { socialMediaApi } from '../api/socialMediaApi';
import { PostSummary } from '../types/api';
import { PostCard } from '../components/PostCard';
import { PaasxoLogoLoader } from '../components/PaasxoLogoLoader';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useIsDeleted } from '../stores/contentEvents';
import { goBack } from '../utils/navigation';

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

type LoadState = 'loading' | 'ready' | 'unavailable' | 'offline';

/**
 * One post by id — opened from a "tagged you" notification/push or a shared
 * link. The server decides visibility (private account, friends-only, blocks,
 * private community), so anything hidden simply reads as unavailable.
 */
export default function PostDetailScreen() {
  const { id, openComments } = useLocalSearchParams<{ id: string; openComments?: string }>();
  const postId = typeof id === 'string' && SAFE_ID.test(id) ? id : null;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [post, setPost] = useState<PostSummary | null>(null);
  const [state, setState] = useState<LoadState>(postId ? 'loading' : 'unavailable');
  const deleted = useIsDeleted('post', postId ?? '');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    if (!postId) return;
    try {
      const data = await socialMediaApi.getPost(postId);
      if (!mounted.current) return;
      if (data?.id) { setPost(data); setState('ready'); } else setState('unavailable');
    } catch (err: any) {
      if (!mounted.current) return;
      // Keep showing a post we already have if only the refresh failed.
      if (err?.response) { setPost(null); setState('unavailable'); }
      else setState((s) => (s === 'ready' ? s : 'offline'));
    }
  }, [postId]);

  useEffect(() => { load(); }, [load]);
  const { refreshing, onRefresh } = usePullToRefresh(load);

  const body = () => {
    if (state === 'loading') {
      return <View style={styles.center}><PaasxoLogoLoader size={44} elevated={false} /></View>;
    }
    if (deleted || state === 'unavailable' || !post) {
      const offline = state === 'offline' && !deleted;
      return (
        <View style={styles.center}>
          {offline
            ? <WifiOff color={colors.textMuted} size={40} strokeWidth={1.6} />
            : <ImageOff color={colors.textMuted} size={40} strokeWidth={1.6} />}
          <Text style={styles.emptyTitle}>{offline ? "Couldn't load this post" : 'Post unavailable'}</Text>
          <Text style={styles.emptyText}>
            {offline
              ? 'Check your connection and pull down to try again.'
              : 'It may have been deleted, or its owner has limited who can see it.'}
          </Text>
        </View>
      );
    }
    return <PostCard post={post} autoOpenComments={openComments === '1'} />;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => goBack(router)} style={styles.backBtn} hitSlop={10} accessibilityLabel="Back">
          <ArrowLeft color={colors.logoBlue || colors.primary} size={22} />
        </Pressable>
        <Text style={styles.title}>Post</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {body()}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '900', color: colors.neutral900 },
  scroll: { flexGrow: 1, paddingHorizontal: 12, paddingBottom: 32 },
  center: { flex: 1, minHeight: 360, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.neutral900, marginTop: 6 },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});
