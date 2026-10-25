import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, BellOff, MessageCircle, PenSquare, Search, Trash2, Bell, X } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { Conversation } from '../api/chatApi';
import {
  clearConversation, loadInbox, setMuted, useChat,
} from '../stores/chatStore';
import { ChatAvatar } from '../components/chat/ChatAvatar';
import { inboxTime } from '../components/chat/chatFormat';
import { ActionMenuSheet } from '../components/ActionMenuSheet';
import { goBack } from '../utils/navigation';
import { extractApiError } from '../utils/apiError';

const BRAND: [string, string] = ['#22D3EE', '#2977C2'];

const Row = memo(function Row({ c, me, typing, online, styles, colors, onOpen, onLongPress }: {
  c: Conversation; me: string | null; typing: boolean; online: boolean;
  styles: ReturnType<typeof createStyles>; colors: ThemeColors;
  onOpen: (c: Conversation) => void; onLongPress: (c: Conversation) => void;
}) {
  const unread = c.unreadCount > 0;
  const lm = c.lastMessage;
  const preview = typing
    ? 'typing…'
    : !lm ? 'Say hi 👋'
    : lm.unsent ? (lm.senderUid === me ? 'You unsent a message' : 'Message unsent')
    : `${lm.senderUid === me ? 'You: ' : ''}${lm.type === 'IMAGE' && !lm.text ? '📷 Photo' : lm.text ?? ''}`;
  return (
    <Pressable
      onPress={() => onOpen(c)}
      onLongPress={() => onLongPress(c)}
      delayLongPress={350}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.neutral100 }]}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${c.otherUser.displayName}${unread ? `, ${c.unreadCount} unread` : ''}`}
    >
      <ChatAvatar uri={c.otherUser.profileImageUrl} name={c.otherUser.displayName} size={56} online={online} ringColor={colors.background} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>{c.otherUser.displayName}</Text>
          <Text style={[styles.time, unread && { color: colors.primary, fontWeight: '800' }]}>{inboxTime(c.lastMessageAt)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, unread && styles.previewUnread, typing && { color: colors.primary, fontStyle: 'italic' }]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {c.muted && <BellOff color={colors.textMuted} size={14} strokeWidth={2.2} />}
          {unread && (
            <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
              <Text style={styles.badgeText}>{c.unreadCount > 99 ? '99+' : c.unreadCount}</Text>
            </LinearGradient>
          )}
        </View>
      </View>
    </Pressable>
  );
});

/** Inbox — every conversation, newest first, live-updated over the socket. */
export default function MessagesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const me = useChat((s) => s.me);
  const inbox = useChat((s) => s.inbox);
  const conversations = useChat((s) => s.conversations);
  const loaded = useChat((s) => s.inboxLoaded);
  const hasMore = useChat((s) => s.inboxHasMore);
  const typing = useChat((s) => s.typing);
  const presence = useChat((s) => s.presence);
  const connected = useChat((s) => s.connected);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [menuFor, setMenuFor] = useState<Conversation | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadInbox(true);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInbox(true).then(() => setError(false)).catch(() => setError(true));
  }, []);

  const isOnline = useCallback((c: Conversation) => presence[c.otherUser.firebaseUid]?.online ?? c.online, [presence]);

  const list = useMemo(() => {
    const all = inbox.map((id) => conversations[id]).filter(Boolean) as Conversation[];
    const q = query.trim().toLowerCase();
    return q ? all.filter((c) => c.otherUser.displayName.toLowerCase().includes(q)) : all;
  }, [inbox, conversations, query]);

  const activeNow = useMemo(() => list.filter(isOnline).slice(0, 12), [list, isOnline]);

  const openChat = useCallback((c: Conversation) => {
    if (c.matchBookingId) {
      router.push(`/chat/match/${c.matchBookingId}` as any);
      return;
    }
    router.push(`/chat/${encodeURIComponent(c.otherUser.firebaseUid)}?name=${encodeURIComponent(c.otherUser.displayName)}` as any);
  }, [router]);

  const header = (
    <>
      <View style={styles.searchWrap}>
        <Search color={colors.textMuted} size={17} strokeWidth={2.3} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search chats"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}><X color={colors.textMuted} size={16} /></Pressable>
        )}
      </View>
      {activeNow.length > 0 && !query && (
        <View>
          <Text style={styles.sectionLabel}>Active now</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeRow}>
            {activeNow.map((c) => (
              <Pressable key={c.id} onPress={() => openChat(c)} style={styles.activeItem}>
                <ChatAvatar uri={c.otherUser.profileImageUrl} name={c.otherUser.displayName} size={58} online ringColor={colors.background} />
                <Text style={styles.activeName} numberOfLines={1}>{c.otherUser.displayName.split(' ')[0]}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      {list.length > 0 && <Text style={styles.sectionLabel}>Chats</Text>}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => goBack(router)} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Back">
          <ArrowLeft color={colors.text} size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Messages</Text>
          {!connected && loaded && <Text style={styles.connecting}>Connecting…</Text>}
        </View>
        <Pressable onPress={() => router.push('/messages-new' as any)} hitSlop={10} accessibilityLabel="New message">
          <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.newBtn}>
            <PenSquare color="#fff" size={18} strokeWidth={2.4} />
          </LinearGradient>
        </Pressable>
      </View>

      {!loaded ? (
        <View style={styles.center}>{error ? (
          <>
            <Text style={styles.emptyTitle}>Couldn’t load your chats</Text>
            <Pressable onPress={refresh} style={styles.cta}><Text style={styles.ctaText}>Try again</Text></Pressable>
          </>
        ) : <ActivityIndicator color={colors.primary} />}</View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Row
              c={item}
              me={me}
              typing={(typing[item.id] ?? 0) > Date.now()}
              online={isOnline(item)}
              styles={styles}
              colors={colors}
              onOpen={openChat}
              onLongPress={setMenuFor}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            query ? <Text style={styles.noResults}>No chats match “{query}”.</Text> : (
              <View style={styles.empty}>
                <LinearGradient colors={BRAND} style={styles.emptyIcon}>
                  <MessageCircle color="#fff" size={34} strokeWidth={2} />
                </LinearGradient>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>Chat with players you follow, your followers, and anyone you’ve played a match with.</Text>
                <Pressable onPress={() => router.push('/messages-new' as any)} style={styles.cta}>
                  <Text style={styles.ctaText}>Start a chat</Text>
                </Pressable>
              </View>
            )
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasMore && !query) loadInbox(false).catch(() => {}); }}
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          initialNumToRender={12}
        />
      )}

      <ActionMenuSheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        actions={menuFor ? [
          {
            key: 'mute',
            label: menuFor.muted ? 'Unmute notifications' : 'Mute notifications',
            icon: menuFor.muted ? <Bell color={colors.text} size={18} /> : <BellOff color={colors.text} size={18} />,
            onPress: () => { setMuted(menuFor.id, !menuFor.muted).catch((e) => Alert.alert('Couldn’t update', extractApiError(e, 'Please try again.'))); },
          },
          {
            key: 'delete',
            label: 'Delete chat',
            destructive: true,
            icon: <Trash2 color={colors.error} size={18} />,
            onPress: () => {
              const c = menuFor;
              Alert.alert('Delete this chat?', `It’s removed for you only — ${c.otherUser.displayName} still has the messages.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { clearConversation(c.id).catch((e) => Alert.alert('Couldn’t delete', extractApiError(e, 'Please try again.'))); } },
              ]);
            },
          },
        ] : []}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '900', color: colors.text },
  connecting: { fontSize: 11.5, color: colors.textMuted, fontWeight: '700', marginTop: -2 },
  newBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, marginBottom: 6,
    height: 42, borderRadius: 14, paddingHorizontal: 12, backgroundColor: colors.neutral100,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  sectionLabel: { fontSize: 12, fontWeight: '900', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginHorizontal: 16, marginTop: 12, marginBottom: 6 },
  activeRow: { paddingHorizontal: 12, gap: 6 },
  activeItem: { width: 72, alignItems: 'center', gap: 5 },
  activeName: { fontSize: 12, fontWeight: '700', color: colors.text, maxWidth: 70 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15.5, fontWeight: '700', color: colors.text },
  nameUnread: { fontWeight: '900' },
  time: { fontSize: 12, color: colors.textMuted },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  preview: { flex: 1, fontSize: 13.5, color: colors.textSecondary },
  previewUnread: { color: colors.text, fontWeight: '700' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11.5, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  empty: { alignItems: 'center', paddingHorizontal: 36, paddingTop: 70, gap: 10 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  emptyText: { fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  cta: { marginTop: 8, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 22, paddingVertical: 11 },
  ctaText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  noResults: { textAlign: 'center', color: colors.textSecondary, marginTop: 30 },
});
