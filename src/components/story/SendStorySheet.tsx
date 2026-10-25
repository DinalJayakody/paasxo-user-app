import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Check, Link2, Search, Send } from 'lucide-react-native';
import { ChatContact, chatApi } from '../../api/chatApi';
import { openConversationWith } from '../../stores/chatStore';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { extractApiError } from '../../utils/apiError';
import { SheetFrame, sheetColors } from './SheetFrame';

const newClientId = () => `story${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * "Send to" for a story (sheet row: share a friend's story with another
 * friend through chat). Lists the people you can message; each recipient
 * gets a chat message that opens the story live — the server re-checks they
 * may see it, so a private story never leaks to someone outside its audience.
 */
export function SendStorySheet({
  storyId, onClose, onShareLink, onSent,
}: {
  storyId: string;
  onClose: () => void;
  onShareLink: () => void;
  onSent: (count: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(0);
  const reqId = useRef(0);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboard(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const id = ++reqId.current;
      setLoading(true);
      try {
        const list = await chatApi.contacts(query.trim() || undefined);
        if (id === reqId.current) setContacts(list);
      } catch {
        if (id === reqId.current) setContacts([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query]);

  const toggle = (uid: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(uid)) next.delete(uid); else if (next.size < 15) next.add(uid);
    return next;
  });

  const send = async () => {
    if (!picked.size || sending) return;
    setSending(true);
    setError(null);
    const uids = [...picked];
    const results = await Promise.allSettled(uids.map(async (uid) => {
      const conv = await openConversationWith(uid);
      await chatApi.sendStory(conv.id, { clientId: newClientId(), storyId, text: note.trim() || undefined });
    }));
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    setSending(false);
    if (failed.length === uids.length) {
      setError(extractApiError(failed[0].reason, 'Couldn’t send — please try again.'));
      return;
    }
    onSent(uids.length - failed.length);
  };

  return (
    <SheetFrame title="Send to" onClose={onClose} heightRatio={0.78} bottomInset={keyboard}>
      <View style={s.searchWrap}>
        <Search color={sheetColors.muted} size={17} strokeWidth={2.4} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search friends"
          placeholderTextColor={sheetColors.muted}
          style={s.input}
          autoCorrect={false}
          keyboardAppearance="dark"
          maxLength={60}
        />
        {loading && <ActivityIndicator color={sheetColors.accent} size="small" />}
      </View>

      <Pressable style={s.linkRow} onPress={onShareLink} accessibilityRole="button">
        <View style={s.linkIcon}><Link2 color="#fff" size={17} strokeWidth={2.4} /></View>
        <Text style={s.linkText}>Share link to other apps</Text>
      </Pressable>

      <FlatList
        data={contacts}
        keyExtractor={(c) => c.user.firebaseUid}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 8 }}
        ListEmptyComponent={loading ? null : (
          <Text style={s.empty}>
            {query.trim() ? 'No one found.' : 'Follow people or play a match together to send them stories.'}
          </Text>
        )}
        renderItem={({ item }) => {
          const on = picked.has(item.user.firebaseUid);
          const avatar = resolveMediaUrl(item.user.profileImageUrl);
          return (
            <Pressable style={s.row} onPress={() => toggle(item.user.firebaseUid)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              {avatar ? <Image source={{ uri: avatar }} style={s.avatar} /> : (
                <View style={[s.avatar, s.avatarPh]}><Text style={s.avatarInitial}>{(item.user.displayName || '?')[0].toUpperCase()}</Text></View>
              )}
              <Text style={s.name} numberOfLines={1}>{item.user.displayName}</Text>
              <View style={[s.check, on && s.checkOn]}>{on && <Check color="#fff" size={14} strokeWidth={3} />}</View>
            </Pressable>
          );
        }}
      />

      {picked.size > 0 && (
        <View style={s.footer}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Write a message…"
            placeholderTextColor={sheetColors.muted}
            style={s.note}
            keyboardAppearance="dark"
            maxLength={500}
          />
          {!!error && <Text style={s.error}>{error}</Text>}
          <Pressable style={[s.sendBtn, sending && { opacity: 0.7 }]} onPress={send} disabled={sending} accessibilityRole="button">
            {sending ? <ActivityIndicator color="#fff" /> : (
              <>
                <Send color="#fff" size={17} strokeWidth={2.4} />
                <Text style={s.sendText}>
                  Send{picked.size > 1 ? ` separately (${picked.size})` : ''}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </SheetFrame>
  );
}

const s = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, borderRadius: 14,
    backgroundColor: sheetColors.card, borderWidth: 1, borderColor: sheetColors.border, paddingHorizontal: 14,
  },
  input: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 0 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  linkIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#24324A', alignItems: 'center', justifyContent: 'center' },
  linkText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty: { color: sheetColors.muted, fontSize: 13.5, textAlign: 'center', marginTop: 24, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarPh: { backgroundColor: '#24324A', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 16 },
  name: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: sheetColors.blue, borderColor: sheetColors.blue },
  footer: { paddingTop: 10, gap: 8 },
  note: {
    height: 44, borderRadius: 14, backgroundColor: sheetColors.card, borderWidth: 1, borderColor: sheetColors.border,
    paddingHorizontal: 14, color: '#fff', fontSize: 15,
  },
  error: { color: '#FF8A8A', fontSize: 13, textAlign: 'center' },
  sendBtn: {
    height: 48, borderRadius: 14, backgroundColor: sheetColors.blue,
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 15.5, fontWeight: '900' },
});
