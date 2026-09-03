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

const cardKey = (u: UserCard) => u.firebaseUid;

interface FollowListModalProps {
  visible: boolean;
  onClose: () => void;
  /** Whose followers/following list to show. */
  uid: string;
  initialTab: 'Followers' | 'Following';
}

/**
 * Instagram-style "who follows / who this person follows" popup, opened by
 * tapping the follower/following counts on a profile. Shares the same
 * pagination logic (usePaginatedList) and socialMediaApi calls FriendsScreen
 * uses for its own Followers/Following tabs, just scoped to an arbitrary uid
 * instead of always "me", and in a compact modal rather than a full screen.
 */
export function FollowListModal({ visible, onClose, uid, initialTab }: FollowListModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const myUid = user?.firebaseUid;
  const [tab, setTab] = useState<'Followers' | 'Following'>(initialTab);
  const [actionLoadingUids, setActionLoadingUids] = useState<Set<string>>(new Set());

  const fetchFollowers = useCallback((page: number) => socialMediaApi.getFollowers(uid, page, 20), [uid]);
  const followers = usePaginatedList<UserCard>(fetchFollowers, cardKey);

  const fetchFollowing = useCallback((page: number) => socialMediaApi.getFollowing(uid, page, 20), [uid]);
  const following = usePaginatedList<UserCard>(fetchFollowing, cardKey);

  const activeList = tab === 'Followers' ? followers : following;

  useEffect(() => {
    if (!visible) return;
    setTab(initialTab);
  }, [visible, initialTab]);

  useEffect(() => {
    if (!visible) return;
    if (activeList.data.length === 0 && !activeList.loading) {
      activeList.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tab]);

  const setActionLoading = (u: string, loading: boolean) => {
    setActionLoadingUids((prev) => {
      const next = new Set(prev);
      if (loading) next.add(u);
      else next.delete(u);
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
        followers.updateItem(targetUid, { relationshipStatus: status });
        following.updateItem(targetUid, { relationshipStatus: status });
      } else {
        await socialMediaApi.unfollowUser(targetUid);
        followers.updateItem(targetUid, { relationshipStatus: 'NONE' });
        following.updateItem(targetUid, { relationshipStatus: 'NONE' });
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{tab === 'Followers' ? 'Followers' : 'Following'}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X color={colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.tabBar}>
            {(['Followers', 'Following'] as const).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabItem, tab === t && styles.tabItemActive]}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {activeList.loading && activeList.data.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : activeList.data.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {tab === 'Followers' ? 'No followers yet' : 'Not following anyone yet'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={activeList.data}
              keyExtractor={cardKey}
              renderItem={renderRow}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onEndReachedThreshold={0.5}
              onEndReached={() => {
                if (!activeList.momentumRef.current) {
                  activeList.momentumRef.current = true;
                  activeList.loadMore();
                }
              }}
              onMomentumScrollBegin={() => { activeList.momentumRef.current = false; }}
              ListFooterComponent={
                activeList.loadingMore ? (
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
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.neutral100, borderRadius: 12,
    padding: 3, marginBottom: 14,
  },
  tabItem: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabItemActive: { backgroundColor: colors.cardBg },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.neutral500 },
  tabTextActive: { color: colors.text },
  listContent: { paddingBottom: 12, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
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
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  footerLoading: { paddingVertical: 16, alignItems: 'center' },
});
