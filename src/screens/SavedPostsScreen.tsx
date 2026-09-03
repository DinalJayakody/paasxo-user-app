import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { socialMediaApi } from '../api/socialMediaApi';
import { PostSummary } from '../types/api';
import { PostGrid } from '../components/PostGrid';
import { PaasxoLogoLoader } from '../components/PaasxoLogoLoader';
import ScreenGlow from '../components/ScreenGlow';

/**
 * Moved out of the Profile tabs into Settings, per the client's request —
 * same data source (socialMediaApi.getSavedPosts) and PostGrid rendering
 * ProfileScreen's Saved tab used before, now a standalone screen.
 */
export default function SavedPostsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await socialMediaApi.getSavedPosts();
        if (!cancelled) setPosts(res.content);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.logoBlue || colors.primary} size={22} />
        </Pressable>
        <Text style={styles.title}>Saved Posts</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <PaasxoLogoLoader size={44} elevated={false} />
          <Text style={styles.loadingText}>Loading saved posts...</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.centerWrap}>
          <Text style={styles.emptyEmoji}>🔖</Text>
          <Text style={styles.emptyTitle}>No saved posts yet</Text>
          <Text style={styles.emptySubtitle}>Tap the bookmark icon on a post to save it here.</Text>
        </View>
      ) : (
        <PostGrid
          posts={posts}
          selectedPostId={selectedPostId}
          onSelectPost={(post) => setSelectedPostId(post.id)}
          onCloseDetail={() => setSelectedPostId(null)}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '900', color: colors.neutral900 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  loadingText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.neutral900 },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});
