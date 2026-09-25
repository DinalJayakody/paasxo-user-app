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
import { Search, Shield, Swords, X } from 'lucide-react-native';
import { teamApi } from '../../api/teamApi';
import { Team } from '../../types/api';
import { ThemeColors } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';

interface TeamSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (team: Team) => void;
  excludeTeamId?: string;
}

/**
 * Team-search-and-select flow backing "Challenge a Team" on TeamDetailScreen
 * - same debounced-search shell as PlayerSearchSheet/AddTeamMemberSheet, but
 * searching teams (GET /teams/search) instead of users.
 */
export function TeamSearchSheet({ visible, onClose, onSelect, excludeTeamId }: TeamSearchSheetProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); }
  }, [visible]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const teams = await teamApi.searchTeams(query.trim());
        setResults(teams.filter((t) => t.id !== excludeTeamId));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

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
            <Text style={styles.headerTitle}>Challenge a Team</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X color={colors.text} size={20} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Search color={colors.textMuted} size={15} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search teams by name..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
            {results.length === 0 && query.trim().length > 0 && !loading && (
              <Text style={styles.emptyText}>No teams found</Text>
            )}
            {results.map((team) => {
              const uri = resolveMediaUrl(team.logoUrl) ?? null;
              return (
                <Pressable key={team.id} style={styles.row} onPress={() => onSelect(team)}>
                  <View style={styles.avatarWrap}>
                    {uri
                      ? <Image source={{ uri }} style={styles.avatarImg} />
                      : <View style={styles.avatarFallback}><Shield color={colors.primary} size={18} strokeWidth={2} /></View>
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{team.name}</Text>
                    <Text style={styles.sub}>{team.members.length} {team.members.length === 1 ? 'player' : 'players'}</Text>
                  </View>
                  <Swords color={colors.primary} size={16} strokeWidth={2} />
                </Pressable>
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
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  sub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
});
