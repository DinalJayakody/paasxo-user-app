import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft, Users, Lock, Globe, Plus, X, Image as ImageIcon,
  UserPlus, Check, MoreVertical, Trash2, LogOut,
} from 'lucide-react-native';
import { ThemeColors, Colors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';
import { PostCard } from '../components/PostCard';
import { communityApi, Community, CommunityJoinRequestItem } from '../api/communityApi';
import { PostSummary } from '../types/api';
import { resolveMediaUrl, resolveAvatarUri } from '../utils/mediaUrl';
import { extractApiError } from '../utils/apiError';
import { goBack } from '../utils/navigation';

export default function CommunityDetailScreen() {
  const { id, openRequests } = useLocalSearchParams<{ id: string; openRequests?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();

  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinBusy, setJoinBusy] = useState(false);

  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedPage, setFeedPage] = useState(0);
  const [feedHasMore, setFeedHasMore] = useState(false);

  const [pendingRequests, setPendingRequests] = useState<CommunityJoinRequestItem[]>([]);
  const [showRequests, setShowRequests] = useState(false);

  const [showComposer, setShowComposer] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [caption, setCaption] = useState('');
  const [mediaAsset, setMediaAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [posting, setPosting] = useState(false);

  const loadCommunity = useCallback(async () => {
    if (!id) return;
    try {
      const c = await communityApi.getById(id);
      setCommunity(c);
    } catch {
      setCommunity(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadFeed = useCallback(async (targetPage: number, append: boolean) => {
    if (!id) return;
    setFeedLoading(true);
    try {
      const result = await communityApi.getFeed(id, targetPage);
      setPosts((prev) => (append ? [...prev, ...result.content] : result.content));
      setFeedPage(targetPage);
      setFeedHasMore(result.hasMore);
    } catch {
      if (!append) setPosts([]);
    } finally {
      setFeedLoading(false);
    }
  }, [id]);

  useEffect(() => { loadCommunity(); }, [loadCommunity]);

  useEffect(() => {
    if (community?.isMember) loadFeed(0, false);
  }, [community?.isMember, loadFeed]);

  const loadPendingRequests = useCallback(async () => {
    if (!id || !community?.isAdmin) return;
    try {
      const reqs = await communityApi.getPendingRequests(id);
      setPendingRequests(reqs);
    } catch {
      setPendingRequests([]);
    }
  }, [id, community?.isAdmin]);

  useEffect(() => { loadPendingRequests(); }, [loadPendingRequests]);

  // Arrived here from a "wants to join" notification — jump straight to the
  // requests sheet instead of making the admin hunt for the banner.
  useEffect(() => {
    if (openRequests === '1' && community?.isAdmin) setShowRequests(true);
  }, [openRequests, community?.isAdmin]);

  const handleJoin = async () => {
    if (!id || joinBusy) return;
    setJoinBusy(true);
    try {
      const updated = await communityApi.join(id);
      setCommunity(updated);
      if (updated.isMember) loadFeed(0, false);
    } catch (e) {
      Alert.alert('Could not join', extractApiError(e, 'Please try again.'));
    } finally {
      setJoinBusy(false);
    }
  };

  const handleLeave = () => {
    if (!id) return;
    Alert.alert('Leave Community?', `You'll need to rejoin to see ${community?.name}'s posts again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          try {
            await communityApi.leave(id);
            loadCommunity();
            setPosts([]);
          } catch (e) {
            Alert.alert('Could not leave', extractApiError(e, 'Please try again.'));
          }
        },
      },
    ]);
  };

  const handleDeleteCommunity = () => {
    if (!id) return;
    Alert.alert('Delete Community?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await communityApi.delete(id);
            goBack(router);
          } catch (e) {
            Alert.alert('Could not delete', extractApiError(e, 'Please try again.'));
          }
        },
      },
    ]);
  };

  const handleApprove = async (reqId: string) => {
    if (!id) return;
    try {
      await communityApi.approveRequest(id, reqId);
      setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
      loadCommunity();
    } catch (e) {
      Alert.alert('Could not approve', extractApiError(e, 'Please try again.'));
    }
  };

  const handleDecline = async (reqId: string) => {
    if (!id) return;
    try {
      await communityApi.declineRequest(id, reqId);
      setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
    } catch (e) {
      Alert.alert('Could not decline', extractApiError(e, 'Please try again.'));
    }
  };

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to add a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) setMediaAsset(result.assets[0]);
  };

  const handlePost = async () => {
    if (!id || (!caption.trim() && !mediaAsset) || posting) return;
    setPosting(true);
    try {
      await communityApi.createPost(id, {
        caption: caption.trim() || undefined,
        media: mediaAsset
          ? { uri: mediaAsset.uri, fileName: mediaAsset.fileName || 'post.jpg', mimeType: mediaAsset.mimeType || 'image/jpeg' }
          : undefined,
        mediaType: 'IMAGE',
      });
      setCaption('');
      setMediaAsset(null);
      setShowComposer(false);
      loadFeed(0, false);
    } catch (e) {
      Alert.alert('Could not post', extractApiError(e, 'Please try again.'));
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!community) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['top']}>
        <Text style={{ color: colors.textMuted }}>Community not found.</Text>
      </SafeAreaView>
    );
  }

  const isCreator = user?.firebaseUid === community.creatorFirebaseUid;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenGlow />
      <View style={styles.topHeaderShadow}>
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGlassStroke} pointerEvents="none" />
          <HeaderIconButton onPress={() => goBack(router)} style={styles.headerIconBtn} hitSlop={8}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
          </HeaderIconButton>
          <Text style={styles.title} numberOfLines={1}>{community.name}</Text>
          {(isCreator || community.isMember) ? (
            <HeaderIconButton onPress={() => setShowMenu(true)} style={styles.headerIconBtn} hitSlop={8}>
              <MoreVertical color={colors.white} size={20} strokeWidth={2.2} />
            </HeaderIconButton>
          ) : <View style={styles.headerIconBtn} />}
        </View>
      </View>

      <FlatList
        data={community.isMember ? posts : []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        onEndReached={() => { if (!feedLoading && feedHasMore) loadFeed(feedPage + 1, true); }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={styles.infoCard}>
            {community.coverImageUrl && (
              <Image source={{ uri: resolveMediaUrl(community.coverImageUrl) }} style={styles.cover} />
            )}
            <View style={styles.infoRow}>
              {community.avatarUrl ? (
                <Image source={{ uri: resolveMediaUrl(community.avatarUrl) }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Users color={colors.primary} size={28} strokeWidth={1.8} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.name} numberOfLines={1}>{community.name}</Text>
                  {community.isPrivate ? (
                    <Lock color={colors.textMuted} size={13} strokeWidth={2.2} />
                  ) : (
                    <Globe color={colors.textMuted} size={13} strokeWidth={2.2} />
                  )}
                </View>
                <Text style={styles.memberCount}>{community.memberCount} member{community.memberCount === 1 ? '' : 's'}</Text>
              </View>
            </View>
            {!!community.description && <Text style={styles.description}>{community.description}</Text>}

            {!community.isMember && (
              <Pressable
                style={[styles.joinBtn, (joinBusy || community.hasPendingRequest) && styles.joinBtnDisabled]}
                disabled={joinBusy || community.hasPendingRequest}
                onPress={handleJoin}
              >
                {joinBusy ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <UserPlus color={Colors.white} size={16} strokeWidth={2.4} />
                    <Text style={styles.joinBtnText}>
                      {community.hasPendingRequest ? 'Request Pending' : community.isPrivate ? 'Request to Join' : 'Join Community'}
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {community.isAdmin && pendingRequests.length > 0 && (
              <Pressable style={styles.requestsBanner} onPress={() => setShowRequests(true)}>
                <Text style={styles.requestsBannerText}>
                  {pendingRequests.length} pending join request{pendingRequests.length === 1 ? '' : 's'}
                </Text>
                <Text style={styles.requestsBannerAction}>Review</Text>
              </Pressable>
            )}

            {community.isMember && <View style={styles.feedDivider} />}
          </View>
        }
        ListEmptyComponent={
          community.isMember ? (
            feedLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
            ) : (
              <View style={styles.center}>
                <Text style={styles.emptyText}>No posts yet — be the first to share something here.</Text>
              </View>
            )
          ) : (
            <View style={styles.center}>
              <Lock color={colors.neutral300} size={36} strokeWidth={1.5} />
              <Text style={styles.emptyText}>
                {community.isPrivate ? 'Join this community to see its posts.' : 'Join this community to see its posts.'}
              </Text>
            </View>
          )
        }
      />

      {community.isMember && (
        <Pressable style={styles.fab} onPress={() => setShowComposer(true)}>
          <Plus color={Colors.white} size={24} strokeWidth={2.5} />
        </Pressable>
      )}

      {/* Post composer */}
      <Modal visible={showComposer} animationType="slide" transparent onRequestClose={() => setShowComposer(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.composerSheet}>
            <View style={styles.composerHeader}>
              <Pressable onPress={() => { setShowComposer(false); setCaption(''); setMediaAsset(null); }}>
                <X color={colors.text} size={22} />
              </Pressable>
              <Text style={styles.composerTitle}>New Post</Text>
              <Pressable onPress={handlePost} disabled={posting || (!caption.trim() && !mediaAsset)}>
                {posting ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={[styles.composerPost, (!caption.trim() && !mediaAsset) && { opacity: 0.4 }]}>Post</Text>
                )}
              </Pressable>
            </View>
            <TextInput
              style={styles.composerInput}
              placeholder={`Share something with ${community.name}…`}
              placeholderTextColor={colors.neutral400}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={280}
            />
            {mediaAsset ? (
              <View style={styles.composerMediaWrap}>
                <Image source={{ uri: mediaAsset.uri }} style={styles.composerMedia} />
                <Pressable style={styles.composerMediaRemove} onPress={() => setMediaAsset(null)}>
                  <X color={Colors.white} size={14} strokeWidth={2.5} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.composerAddMedia} onPress={pickMedia}>
                <ImageIcon color={colors.primary} size={18} strokeWidth={2} />
                <Text style={styles.composerAddMediaText}>Add Photo</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* Pending requests (admin) */}
      <Modal visible={showRequests} animationType="slide" transparent onRequestClose={() => setShowRequests(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.requestsSheet}>
            <View style={styles.composerHeader}>
              <Text style={styles.composerTitle}>Join Requests</Text>
              <Pressable onPress={() => setShowRequests(false)}>
                <X color={colors.text} size={22} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {pendingRequests.map((r) => (
                <View key={r.id} style={styles.requestRow}>
                  <Image source={{ uri: resolveAvatarUri(r.requesterProfileImageUrl, r.requesterDisplayName) }} style={styles.requestAvatar} />
                  <Text style={styles.requestName} numberOfLines={1}>{r.requesterDisplayName}</Text>
                  <Pressable style={styles.requestApproveBtn} onPress={() => handleApprove(r.id)}>
                    <Check color={Colors.white} size={14} strokeWidth={2.5} />
                  </Pressable>
                  <Pressable style={styles.requestDeclineBtn} onPress={() => handleDecline(r.id)}>
                    <X color={colors.error} size={14} strokeWidth={2.5} />
                  </Pressable>
                </View>
              ))}
              {pendingRequests.length === 0 && (
                <Text style={[styles.emptyText, { paddingVertical: 24 }]}>No pending requests.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Overflow menu */}
      <Modal visible={showMenu} animationType="fade" transparent onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuSheet}>
            {!isCreator && community.isMember && (
              <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); handleLeave(); }}>
                <LogOut color={colors.text} size={18} strokeWidth={2} />
                <Text style={styles.menuItemText}>Leave Community</Text>
              </Pressable>
            )}
            {isCreator && (
              <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); handleDeleteCommunity(); }}>
                <Trash2 color={colors.error} size={18} strokeWidth={2} />
                <Text style={[styles.menuItemText, { color: colors.error }]}>Delete Community</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40, gap: 10, paddingHorizontal: 30 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  topHeaderShadow: {
    marginHorizontal: 12, marginTop: 6, marginBottom: 2, borderRadius: 26,
    shadowColor: colors.primaryDark, shadowOpacity: 0.28, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 26, overflow: 'hidden',
  },
  headerGlassStroke: { ...StyleSheet.absoluteFillObject, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.white, flex: 1, textAlign: 'center' },

  infoCard: { paddingHorizontal: 16, paddingTop: 14 },
  cover: { width: '100%', height: 120, borderRadius: 18, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: { backgroundColor: colors.primary + '14', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: colors.text, flexShrink: 1 },
  memberCount: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  description: { fontSize: 13.5, color: colors.textSecondary, marginTop: 10, lineHeight: 19 },

  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, marginTop: 14,
  },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnText: { color: Colors.white, fontSize: 14, fontWeight: '800' },

  requestsBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary + '14', borderRadius: 14, padding: 12, marginTop: 12,
  },
  requestsBannerText: { fontSize: 13, fontWeight: '700', color: colors.text },
  requestsBannerAction: { fontSize: 13, fontWeight: '800', color: colors.primary },

  feedDivider: { height: 1, backgroundColor: colors.neutral200, marginTop: 16 },

  fab: {
    position: 'absolute', right: 20, bottom: 28,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primaryDark, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  composerSheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 32 },
  composerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  composerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  composerPost: { fontSize: 15, fontWeight: '800', color: colors.primary },
  composerInput: { fontSize: 15, color: colors.text, minHeight: 80, textAlignVertical: 'top' },
  composerMediaWrap: { marginTop: 12, position: 'relative', alignSelf: 'flex-start' },
  composerMedia: { width: 100, height: 100, borderRadius: 14 },
  composerMediaRemove: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  composerAddMedia: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    borderWidth: 1.5, borderColor: colors.neutral200, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start',
  },
  composerAddMediaText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  requestsSheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 32 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.neutral200 },
  requestAvatar: { width: 36, height: 36, borderRadius: 18 },
  requestName: { flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.text },
  requestApproveBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  requestDeclineBtn: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.error,
    alignItems: 'center', justifyContent: 'center',
  },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'flex-end', paddingTop: 100, paddingRight: 20 },
  menuSheet: {
    backgroundColor: colors.cardBg, borderRadius: 16, paddingVertical: 6, minWidth: 190,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
  menuItemText: { fontSize: 14, fontWeight: '700', color: colors.text },
});
