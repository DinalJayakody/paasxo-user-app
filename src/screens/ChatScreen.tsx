import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, Bell, BellOff, Camera, Image as ImageIcon, Lock, MoreVertical, Plus, Send, Trash2, Trophy, UserRound, X,
} from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { ChatMessage } from '../api/chatApi';
import { chatSocket } from '../lib/chatSocket';
import {
  clearConversation, discardFailed, loadHistory, markRead, openConversationWith, openMatchConversation, react, retry, sendImage, sendText,
  setActiveConversation, setMuted, shareMatch, unsend, useChat,
} from '../stores/chatStore';
import { ChatAvatar } from '../components/chat/ChatAvatar';
import { MessageBubble } from '../components/chat/MessageBubble';
import { MessageActionsSheet } from '../components/chat/MessageActionsSheet';
import { TypingBubble } from '../components/chat/TypingBubble';
import { MatchPickerSheet } from '../components/chat/MatchPickerSheet';
import { ImageViewerModal } from '../components/chat/ImageViewerModal';
import { ActionMenuSheet } from '../components/ActionMenuSheet';
import { clockTime, dayLabel, parseInstant, presenceLabel, sameDay } from '../components/chat/chatFormat';
import { prepareImageForUpload } from '../utils/mediaCompression';
import { saveMediaToDevice } from '../utils/saveMedia';
import { openProfile } from '../utils/openProfile';
import { goBack } from '../utils/navigation';
import { extractApiError } from '../utils/apiError';

let Clipboard: any = null;
try { Clipboard = require('expo-clipboard'); if (!Clipboard?.setStringAsync) Clipboard = null; } catch { Clipboard = null; }

const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;
const GROUP_GAP_MS = 5 * 60_000;
const TYPING_IDLE_MS = 3500;

type Row =
  | { kind: 'msg'; m: ChatMessage; first: boolean; last: boolean; status?: string }
  | { kind: 'day'; key: string; label: string };

/** A one-to-one chat with another player — or, with `matchId`, a match's group chat — live over the chat socket. */
export default function ChatScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; name?: string; matchId?: string }>();
  const matchId = typeof params.matchId === 'string' && /^\d{1,12}$/.test(params.matchId) ? params.matchId : null;
  const isGroup = !!matchId;
  const otherUid = !isGroup && typeof params.userId === 'string' && SAFE_UID.test(params.userId) ? params.userId : null;

  const me = useChat((s) => s.me);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<{ status?: number; message: string } | null>(null);
  const conversation = useChat((s) => (conversationId ? s.conversations[conversationId] : undefined));
  const messages = useChat((s) => (conversationId ? s.messages[conversationId] : undefined));
  const hasMore = useChat((s) => (conversationId ? s.historyHasMore[conversationId] : false));
  const typingUntil = useChat((s) => (conversationId ? s.typing[conversationId] ?? 0 : 0));
  const presence = useChat((s) => (otherUid ? s.presence[otherUid] : undefined));

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [actionFor, setActionFor] = useState<ChatMessage | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [matchPicker, setMatchPicker] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const typingSent = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The home-indicator padding is only needed while the keyboard is down.
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const other = conversation?.otherUser;
  const otherName = other?.displayName ?? params.name ?? (isGroup ? 'Match chat' : 'Player');
  const memberNames = useMemo(() => {
    const map = new Map<string, string>();
    (conversation?.members ?? []).forEach((u) => map.set(u.firebaseUid, u.displayName || 'Player'));
    return map;
  }, [conversation?.members]);
  const memberAvatars = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    (conversation?.members ?? []).forEach((u) => map.set(u.firebaseUid, u.profileImageUrl));
    return map;
  }, [conversation?.members]);
  const nameOf = useCallback((uid: string) => memberNames.get(uid) ?? 'Player', [memberNames]);

  // Open (or create) the conversation, load history, watch presence.
  useEffect(() => {
    if (!otherUid && !matchId) { setOpenError({ message: 'This chat isn’t available.' }); return; }
    let cancelled = false;
    (matchId ? openMatchConversation(matchId) : openConversationWith(otherUid!))
      .then(async (c) => {
        if (cancelled) return;
        setConversationId(c.id);
        setActiveConversation(c.id);
        await loadHistory(c.id).catch(() => {});
        markRead(c.id);
      })
      .catch((err) => {
        if (!cancelled) setOpenError({ status: err?.response?.status, message: extractApiError(err, 'Couldn’t open this chat.') });
      });
    if (otherUid) chatSocket.setWatch([otherUid]);
    return () => {
      cancelled = true;
      setActiveConversation(null);
      chatSocket.setWatch([]);
    };
  }, [otherUid, matchId]);

  // Stop "typing…" on the other side when leaving.
  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingSent.current && conversationId) chatSocket.typing(conversationId, false);
  }, [conversationId]);

  const online = presence?.online ?? conversation?.online ?? false;
  const lastSeen = presence?.lastSeenAt ?? conversation?.lastSeenAt;
  const otherTyping = typingUntil > Date.now();
  const memberCount = conversation?.members?.length ?? 0;
  const statusLine = isGroup
    ? (otherTyping ? 'someone is typing…' : memberCount ? `${memberCount} player${memberCount === 1 ? '' : 's'} · tap for match` : 'Match chat')
    : otherTyping ? 'typing…' : presenceLabel(online, lastSeen);

  // Newest-first rows for the inverted list, with day separators, grouping and "Seen".
  const rows = useMemo<Row[]>(() => {
    const list = messages ?? [];
    const out: Row[] = [];
    const otherRead = parseInstant(conversation?.otherLastReadAt)?.getTime() ?? 0;
    let lastMineIdx = -1;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].senderUid === me) { lastMineIdx = i; break; }
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      const t = parseInstant(m.createdAt) ?? new Date();
      const prev = list[i - 1];
      const next = list[i + 1];
      const prevT = prev ? parseInstant(prev.createdAt) : null;
      const nextT = next ? parseInstant(next.createdAt) : null;
      const first = !prev || prev.senderUid !== m.senderUid || !prevT || t.getTime() - prevT.getTime() > GROUP_GAP_MS || !sameDay(prevT, t);
      const last = !next || next.senderUid !== m.senderUid || !nextT || nextT.getTime() - t.getTime() > GROUP_GAP_MS || !sameDay(t, nextT);
      let status: string | undefined;
      if (i === lastMineIdx && !m.failed) {
        status = m.pending ? 'Sending…' : !isGroup && otherRead >= t.getTime() ? 'Seen' : `Sent ${clockTime(t)}`;
      }
      out.push({ kind: 'msg', m, first, last, status });
      if (!prevT || !sameDay(prevT, t)) out.push({ kind: 'day', key: `day-${t.toDateString()}`, label: dayLabel(t) });
    }
    return out;
  }, [messages, me, conversation?.otherLastReadAt, isGroup]);

  // ── composer ───────────────────────────────────────────────────────────
  const onChangeText = (t: string) => {
    setText(t);
    if (!conversationId) return;
    if (!typingSent.current && t.trim()) {
      typingSent.current = true;
      chatSocket.typing(conversationId, true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (typingSent.current) { typingSent.current = false; chatSocket.typing(conversationId, false); }
    }, TYPING_IDLE_MS);
  };

  const send = () => {
    const t = text.trim();
    if (!t || !conversationId) return;
    if (t.length > 2000) { Alert.alert('Message too long', 'Keep it under 2000 characters.'); return; }
    sendText(conversationId, t, replyTo);
    setText('');
    setReplyTo(null);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingSent.current) { typingSent.current = false; chatSocket.typing(conversationId, false); }
  };

  const pickPhoto = async (fromCamera: boolean) => {
    setAttachOpen(false);
    if (!conversationId) return;
    try {
      const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', fromCamera ? 'Allow camera access to take a photo.' : 'Allow photo access to send a photo.');
        return;
      }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      const prepared = await prepareImageForUpload(a.uri, a.width, a.height);
      sendImage(conversationId, { uri: prepared.uri, width: prepared.width ?? a.width, height: prepared.height ?? a.height }, replyTo);
      setReplyTo(null);
    } catch {
      Alert.alert('Couldn’t send the photo', 'Please try again.');
    }
  };

  // ── message actions ────────────────────────────────────────────────────
  const onLongPress = useCallback((m: ChatMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Keyboard.dismiss();
    setActionFor(m);
  }, []);
  const onDoubleTap = useCallback((m: ChatMessage) => {
    if (!conversationId || m.pending || m.failed || m.unsent || !me) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    react(conversationId, m, m.reactions?.[me] === '❤️' ? null : '❤️').catch(() => {});
  }, [conversationId, me]);
  const onRetry = useCallback((m: ChatMessage) => { if (conversationId) retry(conversationId, m); }, [conversationId]);
  const onOpenMatch = useCallback((id: number) => router.push(`/match/${id}` as any), [router]);

  const closeActions = () => setActionFor(null);

  const loadOlder = async () => {
    if (!conversationId || !hasMore || loadingOlder) return;
    setLoadingOlder(true);
    try { await loadHistory(conversationId, true); } catch { /* retry on next scroll */ } finally { setLoadingOlder(false); }
  };

  // ── render ─────────────────────────────────────────────────────────────
  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => goBack(router)} hitSlop={10} style={styles.headerBtn} accessibilityLabel="Back">
        <ArrowLeft color={colors.text} size={22} />
      </Pressable>
      <Pressable
        style={styles.headerUser}
        onPress={() => (isGroup ? router.push(`/match/${matchId}` as any) : otherUid && openProfile(router, otherUid, me ?? undefined))}
        accessibilityRole="button"
        accessibilityLabel={isGroup ? `Open ${otherName}` : `Open ${otherName}'s profile`}
      >
        {isGroup ? (
          <View style={[styles.groupAvatar, { backgroundColor: colors.primary + '1A' }]}>
            <Trophy color={colors.primary} size={20} />
          </View>
        ) : (
          <ChatAvatar uri={other?.profileImageUrl} name={otherName} size={38} online={online} ringColor={colors.cardBg} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{otherName}</Text>
          {!!statusLine && (
            <Text style={[styles.headerStatus, (otherTyping || online) && { color: otherTyping ? colors.primary : colors.success }]} numberOfLines={1}>
              {statusLine}
            </Text>
          )}
        </View>
      </Pressable>
      {!!conversationId && (
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} style={styles.headerBtn} accessibilityLabel="Chat options">
          <MoreVertical color={colors.text} size={20} />
        </Pressable>
      )}
    </View>
  );

  if (openError) {
    const notAllowed = openError.status === 403;
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <View style={styles.centerState}>
          <View style={[styles.stateIcon, { backgroundColor: colors.primary + '1A' }]}>
            <Lock color={colors.primary} size={28} />
          </View>
          <Text style={styles.stateTitle}>
            {notAllowed ? (isGroup ? 'Join the match to chat' : `You can’t message ${otherName.split(' ')[0]} yet`) : 'Chat unavailable'}
          </Text>
          <Text style={styles.stateText}>
            {notAllowed
              ? isGroup
                ? 'The match chat is for the organiser and players in the match. Request to join — once the organiser approves you, you’re in.'
                : 'Chat is open between followers and players who’ve shared a match. Follow them or play a match together to start chatting.'
              : openError.message}
          </Text>
          {otherUid && (
            <Pressable onPress={() => openProfile(router, otherUid, me ?? undefined)} style={styles.stateBtn}>
              <Text style={styles.stateBtnText}>View profile</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const canSend = conversation?.canSend !== false;
  const myReaction = actionFor && me ? actionFor.reactions?.[me] ?? null : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!messages ? (
          <View style={styles.centerState}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            data={rows}
            inverted
            keyExtractor={(r) => (r.kind === 'day' ? r.key : r.m.clientId ? `c-${r.m.clientId}` : r.m.id)}
            renderItem={({ item }) => item.kind === 'day' ? (
              <View style={styles.dayWrap}><Text style={styles.dayText}>{item.label}</Text></View>
            ) : (
              <View>
                <MessageBubble
                  m={item.m}
                  mine={item.m.senderUid === me}
                  first={item.first}
                  last={item.last}
                  me={me}
                  otherName={isGroup ? nameOf(item.m.senderUid) : otherName}
                  otherAvatar={isGroup ? memberAvatars.get(item.m.senderUid) : other?.profileImageUrl}
                  senderLabel={isGroup ? nameOf(item.m.senderUid) : null}
                  nameOf={isGroup ? nameOf : undefined}
                  colors={colors}
                  onLongPress={onLongPress}
                  onDoubleTap={onDoubleTap}
                  onOpenImage={setViewer}
                  onOpenMatch={onOpenMatch}
                  onOpenStory={(id) => router.push(`/story/${encodeURIComponent(id)}` as any)}
                  onRetry={onRetry}
                />
                {!!item.status && <Text style={styles.status}>{item.status}</Text>}
              </View>
            )}
            ListHeaderComponent={otherTyping ? <TypingBubble colors={colors} avatar={other?.profileImageUrl} name={otherName} /> : null}
            ListFooterComponent={
              loadingOlder ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
              : !hasMore && rows.length > 0 ? (
                <View style={styles.intro}>
                  <ChatAvatar uri={other?.profileImageUrl} name={otherName} size={72} ringColor={colors.background} />
                  <Text style={styles.introName}>{otherName}</Text>
                  <Text style={styles.introText}>{isGroup ? 'This is the start of the match chat.' : 'This is the start of your chat.'}</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={[styles.intro, { transform: [{ scaleY: -1 }] }]}>
                <ChatAvatar uri={other?.profileImageUrl} name={otherName} size={84} online={online} ringColor={colors.background} />
                <Text style={styles.introName}>{otherName}</Text>
                <Text style={styles.introText}>
                  {isGroup ? 'Everyone in the match can see this chat — sort out kick-off, bibs and who’s bringing the ball.' : 'Say hi 👋 — share a match, a photo, or plan your next game.'}
                </Text>
              </View>
            }
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            contentContainerStyle={{ paddingVertical: 10 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            initialNumToRender={20}
            windowSize={11}
          />
        )}

        {canSend ? (
          <View style={[styles.composerWrap, keyboardUp && { paddingBottom: 8 }]}>
            {replyTo && (
              <View style={styles.replyBar}>
                <View style={styles.replyAccent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.replyLabel}>Replying to {replyTo.senderUid === me ? 'yourself' : otherName.split(' ')[0]}</Text>
                  <Text style={styles.replyPreview} numberOfLines={1}>
                    {replyTo.type === 'IMAGE' ? '📷 Photo' : replyTo.type === 'MATCH' ? `🏟️ ${replyTo.match?.title ?? 'Match'}` : replyTo.text}
                  </Text>
                </View>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={10} accessibilityLabel="Cancel reply"><X color={colors.textMuted} size={18} /></Pressable>
              </View>
            )}
            <View style={styles.composer}>
              <Pressable
                onPress={() => { Keyboard.dismiss(); setAttachOpen(true); }}
                style={styles.attachBtn}
                disabled={!conversationId}
                accessibilityLabel="Attach"
              >
                <Plus color={colors.primary} size={22} strokeWidth={2.6} />
              </Pressable>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={onChangeText}
                placeholder="Message…"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                multiline
                maxLength={2000}
                editable={!!conversationId}
              />
              {text.trim() ? (
                <Pressable onPress={send} accessibilityLabel="Send" hitSlop={6}>
                  <LinearGradient colors={['#22D3EE', '#2977C2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtn}>
                    <Send color="#fff" size={18} strokeWidth={2.4} />
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable onPress={() => pickPhoto(false)} style={styles.attachBtn} disabled={!conversationId} accessibilityLabel="Send a photo">
                  <ImageIcon color={colors.textSecondary} size={22} />
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.blockedBar}>
            <Lock color={colors.textMuted} size={14} />
            <Text style={styles.blockedText}>You can’t reply to this conversation.</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <MessageActionsSheet
        message={actionFor}
        mine={!!actionFor && actionFor.senderUid === me}
        myReaction={myReaction}
        colors={colors}
        onClose={closeActions}
        onReact={(e) => {
          const m = actionFor; closeActions();
          if (m && conversationId) react(conversationId, m, e).catch(() => Alert.alert('Couldn’t react', 'Please try again.'));
        }}
        onReply={() => { setReplyTo(actionFor); closeActions(); setTimeout(() => inputRef.current?.focus(), 250); }}
        onCopy={async () => {
          const t = actionFor?.text ?? ''; closeActions();
          if (Clipboard) await Clipboard.setStringAsync(t).catch(() => {});
          else Share.share({ message: t }).catch(() => {});
        }}
        onUnsend={() => {
          const m = actionFor; closeActions();
          if (!m || !conversationId) return;
          Alert.alert('Unsend message?', 'It will be removed for everyone in this chat.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Unsend', style: 'destructive', onPress: () => unsend(conversationId, m).catch((e) => Alert.alert('Couldn’t unsend', extractApiError(e, 'Please try again.'))) },
          ]);
        }}
        onRetry={() => { const m = actionFor; closeActions(); if (m && conversationId) retry(conversationId, m); }}
        onDiscard={() => { const m = actionFor; closeActions(); if (m && conversationId) discardFailed(conversationId, m); }}
      />

      <ActionMenuSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        actions={[
          { key: 'photo', label: 'Photo from gallery', icon: <ImageIcon color={colors.text} size={18} />, onPress: () => pickPhoto(false) },
          { key: 'camera', label: 'Take a photo', icon: <Camera color={colors.text} size={18} />, onPress: () => pickPhoto(true) },
          { key: 'match', label: 'Share a match', icon: <Trophy color={colors.text} size={18} />, onPress: () => { setAttachOpen(false); setMatchPicker(true); } },
        ]}
      />

      <ActionMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={[
          isGroup
            ? { key: 'profile', label: 'View match', icon: <Trophy color={colors.text} size={18} />, onPress: () => { setMenuOpen(false); router.push(`/match/${matchId}` as any); } }
            : { key: 'profile', label: 'View profile', icon: <UserRound color={colors.text} size={18} />, onPress: () => { setMenuOpen(false); if (otherUid) openProfile(router, otherUid, me ?? undefined); } },
          {
            key: 'mute',
            label: conversation?.muted ? 'Unmute notifications' : 'Mute notifications',
            icon: conversation?.muted ? <Bell color={colors.text} size={18} /> : <BellOff color={colors.text} size={18} />,
            onPress: () => { setMenuOpen(false); if (conversationId) setMuted(conversationId, !conversation?.muted).catch((e) => Alert.alert('Couldn’t update', extractApiError(e, 'Please try again.'))); },
          },
          {
            key: 'delete', label: 'Delete chat', destructive: true, icon: <Trash2 color={colors.error} size={18} />,
            onPress: () => {
              setMenuOpen(false);
              if (!conversationId) return;
              Alert.alert('Delete this chat?', `It’s removed for you only — ${isGroup ? 'the other players' : otherName} still ${isGroup ? 'have' : 'has'} the messages.`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete', style: 'destructive', onPress: async () => {
                    try { await clearConversation(conversationId); goBack(router); } catch (e) { Alert.alert('Couldn’t delete', extractApiError(e, 'Please try again.')); }
                  },
                },
              ]);
            },
          },
        ]}
      />

      <MatchPickerSheet
        visible={matchPicker}
        me={me}
        colors={colors}
        onClose={() => setMatchPicker(false)}
        onPick={(m) => {
          setMatchPicker(false);
          if (conversationId) shareMatch(conversationId, { bookingId: m.bookingId, title: m.title, venueName: m.venueName, sport: m.sport, startAt: m.startAt });
        }}
      />

      <ImageViewerModal
        uri={viewer}
        onClose={() => setViewer(null)}
        onSave={async (uri) => {
          const r = await saveMediaToDevice(uri, false);
          if (r === 'saved') Alert.alert('Saved', 'Photo saved to your gallery.');
          else if (r === 'denied') Alert.alert('Allow Photos access', 'To save, allow Paasxo to add photos in Settings.');
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: colors.cardBg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.neutral200,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 16, fontWeight: '900', color: colors.text },
  headerStatus: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: 1 },
  dayWrap: { alignItems: 'center', marginVertical: 12 },
  dayText: { fontSize: 11.5, fontWeight: '800', color: colors.textMuted, backgroundColor: colors.neutral100, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  status: { alignSelf: 'flex-end', marginRight: 16, marginTop: 3, fontSize: 11, fontWeight: '700', color: colors.textMuted },
  intro: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  introName: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 6 },
  introText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.neutral200, backgroundColor: colors.cardBg, paddingBottom: Platform.OS === 'ios' ? 24 : 8 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10 },
  replyAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.primary },
  replyLabel: { fontSize: 12, fontWeight: '800', color: colors.primary },
  replyPreview: { fontSize: 13, color: colors.textSecondary },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8 },
  attachBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
    backgroundColor: colors.neutral100, color: colors.text, fontSize: 15.5,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  blockedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 18, paddingBottom: 34, backgroundColor: colors.cardBg },
  blockedText: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 10 },
  stateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 17, fontWeight: '900', color: colors.text, textAlign: 'center' },
  stateText: { fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  stateBtn: { marginTop: 6, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10 },
  stateBtnText: { color: '#fff', fontWeight: '800' },
});
