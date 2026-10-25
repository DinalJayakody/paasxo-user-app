import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tag } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { socialMediaApi } from '../api/socialMediaApi';
import { PostSummary } from '../types/api';
import { PostGrid } from './PostGrid';
import { PaasxoLogoLoader } from './PaasxoLogoLoader';
import { useWithoutDeleted } from '../stores/contentEvents';

// Last result per profile, so flipping between tabs doesn't refetch; a pull-to-
// refresh on the profile bumps refreshKey, which always loads fresh.
const cache = new Map<string, { refreshKey: number; posts: PostSummary[] }>();
const MAX_CACHED_PROFILES = 20;

interface Props {
  userId: string;
  /** Bumped by the profile's pull-to-refresh. */
  refreshKey: number;
  isOwn: boolean;
  displayName?: string;
}

/**
 * The profile "Tagged" tab — posts other players tagged this user in, filtered
 * server-side to what the viewer may see (blocks, private accounts,
 * friends-only posts, private communities).
 */
export function TaggedPostsTab({ userId, refreshKey, isOwn, displayName }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cached = cache.get(userId);
  const fresh = cached && cached.refreshKey === refreshKey;
  const [posts, setPosts] = useState<PostSummary[]>(fresh ? cached!.posts : []);
  const [loading, setLoading] = useState(!fresh);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    const hit = cache.get(userId);
    if (hit && hit.refreshKey === refreshKey) { setPosts(hit.posts); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    socialMediaApi.getTaggedPosts(userId, 0, 30)
      .then((page) => {
        if (cancelled) return;
        const list: PostSummary[] = Array.isArray(page?.content) ? page.content : [];
        if (cache.size >= MAX_CACHED_PROFILES) cache.delete(cache.keys().next().value as string);
        cache.set(userId, { refreshKey, posts: list });
        setPosts(list);
      })
      .catch(() => { /* keep whatever is showing; pull to refresh retries */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, refreshKey]);

  const withoutDeleted = useWithoutDeleted('post', posts, (p) => p.id);
  // Untagging yourself only removes the post from *your* Tagged tab.
  const withoutUntagged = useWithoutDeleted('untag', withoutDeleted, (p) => p.id);
  const visible = isOwn ? withoutUntagged : withoutDeleted;

  if (loading && visible.length === 0) {
    return (
      <View style={styles.empty}>
        <PaasxoLogoLoader size={44} elevated={false} />
        <Text style={styles.subtitle}>Loading tagged posts...</Text>
      </View>
    );
  }
  if (visible.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '1F' }]}>
          <Tag color={colors.primary} size={30} strokeWidth={2} />
        </View>
        <Text style={styles.title}>{isOwn ? 'No tags yet' : 'No tagged posts'}</Text>
        <Text style={styles.subtitle}>
          {isOwn
            ? 'When teammates tag you in a post, it shows up here.'
            : `Posts ${displayName?.split(' ')[0] || 'this player'} is tagged in will show up here.`}
        </Text>
      </View>
    );
  }
  return (
    <PostGrid
      posts={visible}
      selectedPostId={selectedPostId}
      onSelectPost={(post) => setSelectedPostId(post.id)}
      onCloseDetail={() => setSelectedPostId(null)}
    />
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 8 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
