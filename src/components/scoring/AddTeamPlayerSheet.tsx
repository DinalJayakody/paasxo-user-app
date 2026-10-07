import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Check, Search, UserPlus, X } from 'lucide-react-native';
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

interface AddTeamPlayerSheetProps {
  visible: boolean;
  onClose: () => void;
  teamName: string;
  /** Already-rostered uids (on EITHER team) — excluded from search results
   *  since a player can only be on one team at a time. */
  excludeUids?: string[];
  onAddRegistered: (player: SearchedUser) => Promise<void> | void;
  onAddCustom: (displayName: string) => Promise<void> | void;
}

/** Roster-building sheet for match-day team setup: search already-registered
 *  Paasxo users, or type a name directly for a walk-up/non-registered
 *  participant. Deliberately a separate, simpler component from
 *  PlayerSearchSheet (which models "invite vs add" semantics for joining a
 *  match itself) — this only ever needs one action: add to this team. */
export function AddTeamPlayerSheet({
  visible,
  onClose,
  teamName,
  excludeUids = [],
  onAddRegistered,
  onAddCustom,
}: AddTeamPlayerSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingUid, setAddingUid] = useState<string | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setError(undefined);
    }
  }, [visible]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const raw: any = await socialMediaApi.searchUsers(query.trim());
        const list: any[] = Array.isArray(raw) ? raw
          : Array.isArray(raw?.content) ? raw.content
          : Array.isArray(raw?.data) ? raw.data : [];
        setResults(
          list
            .map((p) => ({
              firebaseUid: p.firebaseUid ?? p.firebase_uid ?? String(p.id),
              displayName: p.displayName || p.name || 'Unknown',
              profileImageUrl: p.profileImageUrl ?? p.avatarUrl,
            }))
            .filter((p) => !excludeUids.includes(p.firebaseUid))
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query, excludeUids]);

  const handleAddRegistered = async (player: SearchedUser) => {
    setError(undefined);
    setAddingUid(player.firebaseUid);
    try {
      await onAddRegistered(player);
      onClose();
    } catch (err) {
      setError(extractApiError(err, 'Could not add this player. Please try again.'));
    } finally {
      setAddingUid(null);
    }
  };

  const handleAddCustom = async () => {
    const name = query.trim();
    if (!name) return;
    setError(undefined);
    setAddingCustom(true);
    try {
      await onAddCustom(name);
      onClose();
    } catch (err) {
      setError(extractApiError(err, 'Could not add this player. Please try again.'));
    } finally {
      setAddingCustom(false);
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
            <Text style={styles.headerTitle}>Add to {teamName}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <X color={colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Search color={colors.textMuted} size={15} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search a Paasxo user, or type any name..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
            {results.map((player) => (
              <View key={player.firebaseUid} style={styles.playerRow}>
                <View style={styles.avatarWrap}>
                  {resolveMediaUrl(player.profileImageUrl) ? (
                    <Image source={{ uri: resolveMediaUrl(player.profileImageUrl)! }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitial}>{(player.displayName[0] ?? '?').toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.playerName} numberOfLines={1}>{player.displayName}</Text>
                <Pressable
                  style={styles.addBtn}
                  onPress={() => handleAddRegistered(player)}
                  disabled={addingUid != null}
                >
                  {addingUid === player.firebaseUid ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Check color={colors.white} size={13} strokeWidth={2.5} />
                      <Text style={styles.addBtnText}>Add</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ))}
            {results.length === 0 && query.trim().length > 0 && !loading && (
              <Text style={styles.emptyText}>No registered users found for "{query.trim()}"</Text>
            )}
          </ScrollView>

          {query.trim().length > 0 && (
            <Pressable style={styles.customBtn} onPress={handleAddCustom} disabled={addingCustom}>
              {addingCustom ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <UserPlus color={colors.white} size={16} strokeWidth={2.4} />
                  <Text style={styles.customBtnText}>Add "{query.trim()}" as a custom player</Text>
                </>
              )}
            </Pressable>
          )}
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
    maxHeight: '80%', paddingHorizontal: 20, paddingBottom: 28,
  },
  handle: { width: 40, height: 4, backgroundColor: colors.neutral200, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
  closeBtn: { padding: 4 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.neutral100,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  errorText: { color: colors.error, fontSize: 12.5, marginBottom: 8 },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: 16 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatarWrap: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  avatarImg: { width: 36, height: 36 },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 14, fontWeight: '700', color: colors.primary },
  playerName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  addBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  customBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 13, marginTop: 8,
  },
  customBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '700' },
});
