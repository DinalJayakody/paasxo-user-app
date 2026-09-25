import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AlertCircle, Check, Search, UserPlus, X } from 'lucide-react-native';
import { socialMediaApi } from '../../api/socialMediaApi';
import { ThemeColors } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { extractApiError } from '../../utils/apiError';
import { resolveMediaUrl } from '../../utils/mediaUrl';

interface SearchedUser {
  firebaseUid: string;
  displayName: string;
  profileImageUrl?: string;
}

type ActionState = 'loading' | 'added';

interface AddTeamMemberSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (user: SearchedUser) => Promise<void> | void;
  excludeUids?: string[];
}

/**
 * Search-and-add flow for a team roster - same socialMediaApi.searchUsers
 * pattern as PlayerSearchSheet.tsx, but with a single "Add" action instead
 * of the invite/add pair (a captain adding a teammate is immediate, there is
 * no accept/decline step - see TeamService.addMember).
 */
export function AddTeamMemberSheet({ visible, onClose, onAdd, excludeUids = [] }: AddTeamMemberSheetProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setActionStates({});
      setRowErrors({});
    }
  }, [visible]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const raw: any = await socialMediaApi.searchUsers(query.trim());
        const list: any[] = Array.isArray(raw) ? raw
          : Array.isArray(raw?.content) ? raw.content
          : Array.isArray(raw?.data) ? raw.data
          : [];
        setResults(
          list
            .map((u) => ({
              firebaseUid: u.firebaseUid ?? u.firebase_uid ?? String(u.id),
              displayName: u.displayName || u.name || 'Unknown',
              profileImageUrl: u.profileImageUrl ?? u.avatarUrl,
            }))
            .filter((u) => !excludeUids.includes(u.firebaseUid))
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const handleAdd = async (user: SearchedUser) => {
    setRowErrors((prev) => { const n = { ...prev }; delete n[user.firebaseUid]; return n; });
    setActionStates((prev) => ({ ...prev, [user.firebaseUid]: 'loading' }));
    try {
      await onAdd(user);
      setActionStates((prev) => ({ ...prev, [user.firebaseUid]: 'added' }));
    } catch (err) {
      setActionStates((prev) => { const n = { ...prev }; delete n[user.firebaseUid]; return n; });
      setRowErrors((prev) => ({ ...prev, [user.firebaseUid]: extractApiError(err, 'Could not add this player.') }));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          style={styles.sheet}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add Teammate</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X color={colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Search color={colors.textMuted} size={15} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
            {results.length === 0 && query.trim().length > 0 && !loading && (
              <Text style={styles.emptyText}>No players found</Text>
            )}
            {results.map((user) => {
              const state = actionStates[user.firebaseUid];
              const errorMsg = rowErrors[user.firebaseUid];
              const uri = resolveMediaUrl(user.profileImageUrl) ?? null;
              return (
                <View key={user.firebaseUid}>
                  <View style={styles.row}>
                    <View style={styles.avatarWrap}>
                      {uri
                        ? <Image source={{ uri }} style={styles.avatarImg} />
                        : <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitial}>{(user.displayName[0] ?? '?').toUpperCase()}</Text>
                          </View>
                      }
                    </View>
                    <Text style={styles.name} numberOfLines={1}>{user.displayName}</Text>
                    {!state && (
                      <Pressable style={styles.addBtn} onPress={() => handleAdd(user)}>
                        <UserPlus color={colors.white} size={12} strokeWidth={2.5} />
                        <Text style={styles.addBtnText}>Add</Text>
                      </Pressable>
                    )}
                    {state === 'loading' && <ActivityIndicator size="small" color={colors.primary} />}
                    {state === 'added' && (
                      <View style={styles.addedBadge}>
                        <Check color={colors.success} size={12} strokeWidth={2.5} />
                        <Text style={styles.addedText}>Added</Text>
                      </View>
                    )}
                  </View>
                  {errorMsg && (
                    <View style={styles.errorRow}>
                      <AlertCircle color={colors.error} size={12} strokeWidth={2} />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', paddingHorizontal: 20, paddingBottom: 32,
  },
  handle: { width: 40, height: 4, backgroundColor: colors.neutral200, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  closeBtn: { padding: 4 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.neutral100,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  avatarWrap: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  avatarImg: { width: 40, height: 40 },
  avatarFallback: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: colors.primary },
  name: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  addBtnText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  addedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  addedText: { fontSize: 12, fontWeight: '600', color: colors.success },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 50, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: colors.neutral100,
  },
  errorText: { fontSize: 12, color: colors.error, flex: 1, flexWrap: 'wrap' },
});
