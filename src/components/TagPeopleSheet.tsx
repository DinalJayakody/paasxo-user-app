import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Check, Search, UserPlus, X } from 'lucide-react-native';
import { ThemeColors, Colors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { socialMediaApi } from '../api/socialMediaApi';
import { resolveAvatarUri } from '../utils/mediaUrl';

/** A user picked for tagging (what posts/stories send is just the uid). */
export interface TaggedPerson {
  firebaseUid: string;
  displayName: string;
  profileImageUrl?: string;
}

export const MAX_TAGS = 20; // mirrors SocialService.MAX_TAGS on the backend

interface Props {
  visible: boolean;
  selected: TaggedPerson[];
  onChange: (people: TaggedPerson[]) => void;
  onClose: () => void;
  title?: string;
  /** Selection cap (defaults to MAX_TAGS). */
  max?: number;
  /** Copy for the cap hint, e.g. "You can hide your story from up to 500 people." */
  limitHint?: string;
  /** Empty-state prompt before typing. */
  searchHint?: string;
}

/**
 * Search Paasxo users and tag them — shared by Create Post and the story
 * composer. Debounced (one request per pause in typing), stale responses are
 * ignored, you can't tag yourself, and the cap matches the server's. The
 * server re-validates every tag (blocks, real users, cap) regardless.
 */
export function TagPeopleSheet({ visible, selected, onChange, onClose, title = 'Tag people', max = MAX_TAGS, limitHint, searchHint }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaggedPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); }
  }, [visible]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { requestId.current++; setResults([]); setSearching(false); return; }
    const t = setTimeout(async () => {
      const id = ++requestId.current;
      setSearching(true);
      try {
        const page = await socialMediaApi.searchUsers(q, 0, 20);
        if (id !== requestId.current) return;
        const content: any[] = Array.isArray(page?.content) ? page.content : [];
        setResults(content
          .filter((u) => u?.firebaseUid && u.firebaseUid !== user?.firebaseUid)
          .map((u) => ({ firebaseUid: u.firebaseUid, displayName: u.displayName || 'Player', profileImageUrl: u.profileImageUrl })));
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, user?.firebaseUid]);

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.firebaseUid)), [selected]);
  const toggle = (p: TaggedPerson) => {
    if (selectedIds.has(p.firebaseUid)) onChange(selected.filter((s) => s.firebaseUid !== p.firebaseUid));
    else if (selected.length < max) onChange([...selected, p]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.doneBtn}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          {selected.length > 0 && (
            <View style={styles.chips}>
              {selected.map((p) => (
                <Pressable key={p.firebaseUid} style={styles.chip} onPress={() => toggle(p)} accessibilityLabel={`Remove ${p.displayName}`}>
                  <Image source={{ uri: resolveAvatarUri(p.profileImageUrl, p.displayName) }} style={styles.chipAvatar} />
                  <Text style={styles.chipText} numberOfLines={1}>{p.displayName}</Text>
                  <X color={colors.primary} size={13} strokeWidth={2.6} />
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.searchWrap}>
            <Search color={colors.textMuted} size={16} strokeWidth={2.2} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search Paasxo players"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={40}
            />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          {selected.length >= max && (
            <Text style={styles.hint}>{limitHint ?? `You can tag up to ${max} people.`}</Text>
          )}

          <FlatList
            data={results}
            keyExtractor={(p) => p.firebaseUid}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <UserPlus color={colors.neutral300} size={32} strokeWidth={1.6} />
                <Text style={styles.emptyText}>
                  {query.trim().length < 2 ? (searchHint ?? 'Type a name to find players to tag.') : searching ? 'Searching…' : 'No players found.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const on = selectedIds.has(item.firebaseUid);
              return (
                <Pressable style={styles.row} onPress={() => toggle(item)}>
                  <Image source={{ uri: resolveAvatarUri(item.profileImageUrl, item.displayName) }} style={styles.avatar} />
                  <Text style={styles.name} numberOfLines={1}>{item.displayName}</Text>
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on && <Check color={Colors.white} size={14} strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingBottom: 28, maxHeight: '80%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.neutral300, marginTop: 8, marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  doneBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7 },
  doneText: { color: Colors.white, fontSize: 13.5, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '48%',
    backgroundColor: colors.primary + '14', borderRadius: 16, paddingLeft: 4, paddingRight: 10, paddingVertical: 4,
  },
  chipAvatar: { width: 22, height: 22, borderRadius: 11 },
  chipText: { flexShrink: 1, fontSize: 12.5, fontWeight: '700', color: colors.primary },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6,
    backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: colors.text, paddingVertical: 0 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  list: { marginTop: 8, minHeight: 160 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.neutral100 },
  name: { flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.text },
  check: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.neutral300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyText: { fontSize: 13, color: colors.textMuted },
});
