import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AlertCircle, Check, Search, UserCheck, UserPlus, X } from 'lucide-react-native';
import { socialMediaApi } from '../api/socialMediaApi';
import { Colors } from '../styles/colors';
import { extractApiError } from '../utils/apiError';
import { resolveMediaUrl } from '../utils/mediaUrl';

export interface SearchedPlayer {
  firebaseUid: string;
  displayName: string;
  profileImageUrl?: string;
  skillLevel?: string;
  sport?: string;
}

type ActionState = 'request_sent' | 'added' | 'loading_request' | 'loading_add';

interface PlayerSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onRequestToJoin: (player: SearchedPlayer) => Promise<void> | void;
  /** When omitted the "Add" button is hidden (invite-only mode for non-organizer participants). */
  onDirectAdd?: (player: SearchedPlayer) => Promise<void> | void;
  excludeUids?: string[];
  title?: string;
}

export function PlayerSearchSheet({
  visible,
  onClose,
  onDirectAdd,
  onRequestToJoin,
  excludeUids = [],
  title = 'Invite Players',
}: PlayerSearchSheetProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchedPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [playerErrors, setPlayerErrors] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setActionStates({});
      setPlayerErrors({});
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
          : Array.isArray(raw?.users) ? raw.users : [];

        setResults(
          list
            .filter((p) => {
              const uid = p.firebaseUid ?? p.firebase_uid ?? String(p.id);
              return !excludeUids.includes(uid) && !actionStates[uid];
            })
            .map((p) => ({
              firebaseUid: p.firebaseUid ?? p.firebase_uid ?? String(p.id),
              displayName: p.displayName || p.name || 'Unknown',
              profileImageUrl: p.profileImageUrl ?? p.avatarUrl,
              skillLevel: p.skillLevel,
              sport: Array.isArray(p.sport) ? p.sport[0] : p.sport,
            }))
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const setAction = (uid: string, state: ActionState) =>
    setActionStates((prev) => ({ ...prev, [uid]: state }));

  const clearAction = (uid: string) =>
    setActionStates((prev) => { const n = { ...prev }; delete n[uid]; return n; });

  const setError = (uid: string, msg: string) =>
    setPlayerErrors((prev) => ({ ...prev, [uid]: msg }));

  const clearError = (uid: string) =>
    setPlayerErrors((prev) => { const n = { ...prev }; delete n[uid]; return n; });

  const handleRequest = async (player: SearchedPlayer) => {
    clearError(player.firebaseUid);
    setAction(player.firebaseUid, 'loading_request');
    try {
      await onRequestToJoin(player);
      setAction(player.firebaseUid, 'request_sent');
    } catch (err) {
      clearAction(player.firebaseUid);
      setError(player.firebaseUid, extractApiError(err, 'Could not send invitation. Please try again.'));
    }
  };

  const handleDirectAdd = async (player: SearchedPlayer) => {
    if (!onDirectAdd) return;
    clearError(player.firebaseUid);
    setAction(player.firebaseUid, 'loading_add');
    try {
      await onDirectAdd(player);
      setAction(player.firebaseUid, 'added');
    } catch (err) {
      clearAction(player.firebaseUid);
      setError(player.firebaseUid, extractApiError(err, 'Could not add player. Please try again.'));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X color={Colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Search color={Colors.textMuted} size={15} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name..."
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color={Colors.primary} />}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
            {results.length === 0 && query.trim().length > 0 && !loading && (
              <Text style={styles.emptyText}>No players found</Text>
            )}
            {results.map((player) => {
              const state = actionStates[player.firebaseUid];
              const errorMsg = playerErrors[player.firebaseUid];
              const uri = resolveMediaUrl(player.profileImageUrl) ?? null;
              return (
                <View key={player.firebaseUid}>
                  <View style={styles.playerRow}>
                    <View style={styles.avatarWrap}>
                      {uri
                        ? <Image source={{ uri }} style={styles.avatarImg} />
                        : <View style={styles.avatarFallback}>
                            <Text style={styles.avatarInitial}>
                              {(player.displayName[0] ?? '?').toUpperCase()}
                            </Text>
                          </View>
                      }
                    </View>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName} numberOfLines={1}>{player.displayName}</Text>
                      {player.skillLevel && (
                        <Text style={styles.playerSub}>{player.skillLevel}</Text>
                      )}
                    </View>
                    <View style={styles.actionButtons}>
                      {!state && (
                        <>
                          <Pressable
                            style={styles.requestBtn}
                            onPress={() => handleRequest(player)}
                          >
                            <UserPlus color={Colors.white} size={12} strokeWidth={2.5} />
                            <Text style={styles.btnText}>Invite</Text>
                          </Pressable>
                          {onDirectAdd && (
                            <Pressable
                              style={styles.addBtn}
                              onPress={() => handleDirectAdd(player)}
                            >
                              <UserCheck color={Colors.white} size={12} strokeWidth={2.5} />
                              <Text style={styles.btnText}>Add</Text>
                            </Pressable>
                          )}
                        </>
                      )}
                      {(state === 'loading_request' || state === 'loading_add') && (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      )}
                      {state === 'request_sent' && (
                        <View style={styles.sentBadge}>
                          <Check color={Colors.primary} size={12} strokeWidth={2.5} />
                          <Text style={styles.sentText}>Sent</Text>
                        </View>
                      )}
                      {state === 'added' && (
                        <View style={styles.addedBadge}>
                          <Check color={Colors.success} size={12} strokeWidth={2.5} />
                          <Text style={[styles.sentText, { color: Colors.success }]}>Added</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Inline error below the player row */}
                  {errorMsg && (
                    <View style={styles.errorRow}>
                      <AlertCircle color={Colors.error} size={12} strokeWidth={2} />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Invite — player receives a notification and must accept</Text>
            </View>
            {onDirectAdd && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.legendText}>Add — added immediately (if you've confirmed with them)</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.neutral200,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.neutral100,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 24,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    gap: 10,
    borderBottomWidth: 0,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 40,
    height: 40,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  playerSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.success,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  btnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  sentText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 50,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral100,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    flex: 1,
    flexWrap: 'wrap',
  },
  legend: {
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral100,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
