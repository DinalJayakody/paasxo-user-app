import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { socialMediaApi } from '../api/socialMediaApi';
import { useAuth } from '../context/AuthContext';
import { UserCard, FollowRelationship } from '../types/api';
import { resolveAvatarUri } from '../utils/mediaUrl';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { SearchBar } from './SearchBar';

const cardKey = (u: UserCard) => u.firebaseUid;

// Matches FeedScreen's own search-as-you-type delay — long enough that a
// fast typist doesn't fire a request per keystroke, short enough that the
// list still feels live.
const SEARCH_DEBOUNCE_MS = 350;

interface LikesModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
}

/**
 * "Liked by" popup for a post's like count — same sheet chrome, pagination
 * (usePaginatedList) and follow-button behavior as FollowListModal (the
 * Followers/Following popup), just backed by socialMediaApi.getPostLikers
 * and with a search box filtering the post's own likers by name instead of
 * a Followers/Following tab switch. Kept as its own component rather than
 * folded into FollowListModal since the two are shaped differently (a single
 * searchable list here vs. two tabs there) and conflating them would make
 * both harder to follow.
 */
export function LikesModal({ visible, onClose, postId }: LikesModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const myUid = user?.firebaseUid;

  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [actionLoadingUids, setActionLoadingUids] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchText.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchText]);

  const fetchLikers = useCallback(
    (page: number) => socialMediaApi.getPostLikers(postId, debouncedQuery, page, 20),
    [postId, debouncedQuery]
  );
  const likers = usePaginatedList<UserCard>(fetchLikers, cardKey);

  // Unconditional reload (not "only if the list is currently empty" — see
  // FollowListModal's tab-switch effect) since a changed search term must
  // always replace whatever the previous term's results were, even when
  // there were results already on screen.
  useEffect(() => {
    if (!visible) return;
    likers.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, debouncedQuery]);

  // Every other bit of local UI state resets on close, so reopening this for
  // a different post (or the same one, later) never shows a stale search box.
  useEffect(() => {
    if (!visible) {
      setSearchText('');
      setDebouncedQuery('');
      setActionLoadingUids(new Set());
    }
  }, [visible]);

  const setActionLoading = (uid: string, loading: boolean) => {
    setActionLoadingUids((prev) => {
      const next = new Set(prev);
      if (loading) next.add(uid); else next.delete(uid);
      return next;
    });
  };

  const handleFollowPress = async (item: UserCard) => {
    const targetUid = item.firebaseUid;
    if (actionLoadingUids.has(targetUid)) return;
    setActionLoading(targetUid, true);
    try {
      if (item.relationshipStatus === 'NONE') {
        const res = await socialMediaApi.followUser(targetUid);
        const status: FollowRelationship = res?.status === 'PENDING' ? 'PENDING' : 'ACCEPTED';
        likers.updateItem(targetUid, { relationshipStatus: status });
      } else {
        await socialMediaApi.unfollowUser(targetUid);
        likers.updateItem(targetUid, { relationshipStatus: 'NONE' });
      }
    } catch {
      // Leave state as-is on failure so the user can retry.
    } finally {
      setActionLoading(targetUid, false);
    }
  };

  const goToProfile = (targetUid: string) => {
    onClose();
    if (targetUid === myUid) {
      router.push('/profile');
    } else {
      router.push(`/friend-profile?user=${targetUid}` as any);
    }
  };

  const renderRow = ({ item }: { item: UserCard }) => {
    const targetUid = item.firebaseUid;
    const isSelf = targetUid === myUid;
    const isLoading = actionLoadingUids.has(targetUid);
    return (
      <Pressable style={styles.row} onPress={() => goToProfile(targetUid)}>
        <Image source={{ uri: resolveAvatarUri(item.profileImageUrl, item.displayName) }} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
          {!!item.sports?.[0] && <Text style={styles.meta} numberOfLines={1}>{item.sports[0]}</Text>}
        </View>
        {!isSelf && item.relationshipStatus && item.relationshipStatus !== 'SELF' && (
          isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Pressable
              onPress={() => handleFollowPress(item)}
              hitSlop={6}
              style={[
                styles.followBtn,
                item.relationshipStatus === 'ACCEPTED' && styles.followingBtn,
                item.relationshipStatus === 'PENDING' && styles.requestedBtn,
              ]}
            >
              <Text
                style={[
                  styles.followBtnText,
                  item.relationshipStatus === 'ACCEPTED' && styles.followingBtnText,
                  item.relationshipStatus === 'PENDING' && styles.requestedBtnText,
                ]}
              >
                {item.relationshipStatus === 'ACCEPTED' ? 'Following' : item.relationshipStatus === 'PENDING' ? 'Requested' : 'Follow'}
              </Text>
            </Pressable>
          )
        )}
      </Pressable>
    );
  };

  const showEmpty = !likers.loading && likers.data.length === 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Likes</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <X color={colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <SearchBar value={searchText} onChangeText={setSearchText} placeholder="Search people who liked this" />
          </View>

          {likers.loading && likers.data.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : showEmpty ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {debouncedQuery ? 'No one matching that name liked this post' : 'No likes yet'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={likers.data}
              keyExtractor={cardKey}
              renderItem={renderRow}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onEndReachedThreshold={0.5}
              onEndReached={() => {
                if (!likers.momentumRef.current) {
                  likers.momentumRef.current = true;
                  likers.loadMore();
                }
              }}
              onMomentumScrollBegin={() => { likers.momentumRef.current = false; }}
              ListFooterComponent={
                likers.loadingMore ? (
                  <View style={styles.footerLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    minHeight: '50%',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.neutral200, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
  closeBtn: { padding: 4 },
  searchWrap: { marginBottom: 14 },
  listContent: { paddingBottom: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.neutral100 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  followBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.cardBg,
  },
  followBtnText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  followingBtn: { backgroundColor: colors.neutral100, borderColor: colors.neutral200 },
  followingBtnText: { color: colors.neutral600 },
  requestedBtn: { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
  requestedBtnText: { color: colors.primary },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', textAlign: 'center' },
  footerLoading: { paddingVertical: 16, alignItems: 'center' },
});
