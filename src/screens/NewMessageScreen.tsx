import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, Swords, UserCheck, Users, X } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { chatApi, ChatContact } from '../api/chatApi';
import { ChatAvatar } from '../components/chat/ChatAvatar';
import { goBack } from '../utils/navigation';

/** Pick who to message: people you follow / who follow you, and players you've shared a match with. */
export default function NewMessageScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [contacts, setContacts] = useState<ChatContact[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const reqId = useRef(0);

  const load = async () => {
    const id = ++reqId.current;
    setError(false);
    try {
      const list = await chatApi.contacts();
      if (id === reqId.current) setContacts(list);
    } catch {
      if (id === reqId.current) setError(true);
    }
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (contacts ?? []).filter((c) => !q || c.user.displayName.toLowerCase().includes(q));
  }, [contacts, query]);

  const open = (c: ChatContact) =>
    router.replace(`/chat/${encodeURIComponent(c.user.firebaseUid)}?name=${encodeURIComponent(c.user.displayName)}` as any);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>New message</Text>
        <Pressable onPress={() => goBack(router)} hitSlop={10} style={styles.close} accessibilityLabel="Close">
          <X color={colors.text} size={20} />
        </Pressable>
      </View>
      <View style={styles.searchWrap}>
        <Search color={colors.textMuted} size={17} strokeWidth={2.3} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoFocus
          autoCorrect={false}
        />
      </View>
      <View style={styles.hintRow}>
        <Users color={colors.textMuted} size={13} />
        <Text style={styles.hint}>You can message people you follow, your followers and players from your matches.</Text>
      </View>

      {contacts == null ? (
        <View style={styles.center}>
          {error ? (
            <Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>Couldn’t load — tap to retry</Text></Pressable>
          ) : <ActivityIndicator color={colors.primary} />}
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(c) => c.user.firebaseUid}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {query ? `No one matches “${query}”.` : 'No contacts yet — follow players or join a match to start chatting.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.neutral100 }]}>
              <ChatAvatar uri={item.user.profileImageUrl} name={item.user.displayName} size={48} online={item.online} ringColor={colors.background} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.user.displayName}</Text>
                <View style={styles.reason}>
                  {item.reason === 'MATCH'
                    ? <Swords color={colors.primary} size={12} strokeWidth={2.4} />
                    : <UserCheck color={colors.primary} size={12} strokeWidth={2.4} />}
                  <Text style={styles.reasonText}>{item.reason === 'MATCH' ? 'Played together' : 'Following'}{item.online ? ' · Active now' : ''}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 20, fontWeight: '900', color: colors.text },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral100 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, height: 42, borderRadius: 14,
    paddingHorizontal: 12, backgroundColor: colors.neutral100,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 18, marginTop: 10, marginBottom: 6 },
  hint: { flex: 1, fontSize: 11.5, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  reasonText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retry: { padding: 12 },
  retryText: { color: colors.primary, fontWeight: '800' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, paddingHorizontal: 40, lineHeight: 20 },
});
