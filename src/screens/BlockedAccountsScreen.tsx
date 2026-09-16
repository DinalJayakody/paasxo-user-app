import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldOff } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { socialMediaApi } from '../api/socialMediaApi';
import { UserCard } from '../types/api';
import { resolveAvatarUri } from '../utils/mediaUrl';
import { usePaginatedList } from '../hooks/usePaginatedList';
import ScreenGlow from '../components/ScreenGlow';
import { goBack } from '../utils/navigation';

const cardKey = (u: UserCard) => u.firebaseUid;

// Reachable from Settings > Danger Zone. Required alongside blocking itself -
// App Store Review Guideline 1.2 expects a block to be reversible from within
// the app, not just a one-way action.
export default function BlockedAccountsScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [unblockingUids, setUnblockingUids] = useState<Set<string>>(new Set());

  const fetchBlocked = useCallback((page: number) => socialMediaApi.getBlockedUsers(page, 20), []);
  const list = usePaginatedList<UserCard>(fetchBlocked, cardKey);

  useEffect(() => { list.reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnblock = async (uid: string) => {
    if (unblockingUids.has(uid)) return;
    setUnblockingUids((prev) => new Set(prev).add(uid));
    try {
      await socialMediaApi.unblockUser(uid);
      list.removeItem(uid);
    } catch {
      // Leave it in the list so the user can retry.
    } finally {
      setUnblockingUids((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable onPress={() => goBack(router)} style={styles.backBtn}>
          <ArrowLeft color={colors.logoBlue || colors.primary} size={22} />
        </Pressable>
        <Text style={styles.title}>Blocked Accounts</Text>
        <View style={{ width: 40 }} />
      </View>

      {list.loading && list.data.length === 0 ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : list.data.length === 0 ? (
        <View style={styles.centerWrap}>
          <ShieldOff color={colors.neutral300} size={40} strokeWidth={1.6} />
          <Text style={styles.emptyTitle}>No blocked accounts</Text>
          <Text style={styles.emptySubtitle}>Accounts you block will show up here, and you can unblock them anytime.</Text>
        </View>
      ) : (
        <FlatList
          data={list.data}
          keyExtractor={cardKey}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (!list.momentumRef.current) {
              list.momentumRef.current = true;
              list.loadMore();
            }
          }}
          onMomentumScrollBegin={() => { list.momentumRef.current = false; }}
          renderItem={({ item }) => {
            const busy = unblockingUids.has(item.firebaseUid);
            return (
              <View style={styles.row}>
                <Image source={{ uri: resolveAvatarUri(item.profileImageUrl, item.displayName) }} style={styles.avatar} />
                <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
                <Pressable
                  onPress={() => handleUnblock(item.firebaseUid)}
                  disabled={busy}
                  style={[styles.unblockBtn, busy && styles.unblockBtnDisabled]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.unblockBtnText}>Unblock</Text>
                  )}
                </Pressable>
              </View>
            );
          }}
          ListFooterComponent={
            list.loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '900', color: colors.neutral900 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    paddingHorizontal: 12, backgroundColor: colors.cardBg, borderRadius: 14, marginBottom: 8,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.neutral200, backgroundColor: colors.neutral100,
    minWidth: 76, alignItems: 'center',
  },
  unblockBtnDisabled: { opacity: 0.6 },
  unblockBtnText: { fontSize: 12, fontWeight: '800', color: colors.text },
  footerLoading: { paddingVertical: 16, alignItems: 'center' },
});
