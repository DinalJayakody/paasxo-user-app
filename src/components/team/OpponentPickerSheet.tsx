import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Search, Shield, Users, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors } from '../../styles/colors';
import { Team } from '../../types/api';
import { teamApi } from '../../api/teamApi';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { teamMatchSportLabel } from '../../constants/teamMatchSports';

/**
 * Pick the team to challenge: suggested same-sport teams (nearest first)
 * straight away, or search by name. Teams you're on are never listed.
 * A name search shows every matching team: one that plays a different sport
 * stays visible but can't be picked, with the reason, instead of silently
 * vanishing (it read as "the team doesn't exist").
 */
export function OpponentPickerSheet({
  visible, onClose, onPick, sport, myTeamIds, myUid, near,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (t: Team) => void;
  sport?: string;
  myTeamIds: string[];
  /** Hides teams you're a member of (not just ones you captain). */
  myUid?: string | null;
  near?: { latitude: number; longitude: number } | null;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [q, setQ] = useState('');
  const [suggested, setSuggested] = useState<Team[]>([]);
  const [results, setResults] = useState<Team[] | null>(null);
  const [loading, setLoading] = useState(false);
  const req = useRef(0);
  const isMine = (t: Team) =>
    myTeamIds.includes(t.id) || (!!myUid && (t.captainFirebaseUid === myUid || !!t.members?.some((m) => m.firebaseUid === myUid)));
  const playable = (t: Team) => !sport || String(t.sport).toUpperCase() === String(sport).toUpperCase();

  useEffect(() => {
    if (!visible) { setQ(''); setResults(null); return; }
    setLoading(true);
    teamApi.suggestOpponents({ sport, lat: near?.latitude, lng: near?.longitude })
      .then((ts) => setSuggested(ts.filter((t) => !isMine(t))))
      .catch(() => setSuggested([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sport]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    const id = ++req.current;
    const t = setTimeout(() => {
      teamApi.searchTeams(term)
        // Same-sport matches first; other sports listed after, disabled.
        .then((ts) => {
          if (id !== req.current) return;
          const others = ts.filter((x) => !isMine(x));
          setResults([...others.filter(playable), ...others.filter((x) => !playable(x))]);
        })
        .catch(() => { if (id === req.current) setResults([]); });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sport]);

  const list = results ?? suggested;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.wrap} pointerEvents="box-none">
        <View style={s.sheet}>
          <View style={s.head}>
            <Text style={s.title}>Choose your opponent</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><X color={colors.text} size={20} /></Pressable>
          </View>
          <View style={s.inputRow}>
            <Search color={colors.textMuted} size={17} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search teams by name"
              placeholderTextColor={colors.textMuted}
              style={s.input}
              autoCorrect={false}
            />
            {!!q && <Pressable onPress={() => setQ('')} hitSlop={8}><X color={colors.textMuted} size={16} /></Pressable>}
          </View>
          <Text style={s.caption}>{results ? 'Search results' : 'Suggested teams'}</Text>
          {loading && !results ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={list}
              keyExtractor={(t) => t.id}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => {
                const logo = resolveMediaUrl(item.logoUrl);
                const ok = playable(item);
                const count = item.members?.length ?? 0;
                return (
                  <Pressable
                    style={[s.row, !ok && s.rowDisabled]}
                    disabled={!ok}
                    onPress={() => { onPick(item); onClose(); }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !ok }}
                    accessibilityLabel={ok ? `Challenge ${item.name}` : `${item.name} plays ${teamMatchSportLabel(item.sport)}`}
                  >
                    {logo ? <Image source={{ uri: logo }} style={s.logo} /> : (
                      <View style={[s.logo, s.logoEmpty]}><Shield color={colors.primary} size={18} /></View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                      <View style={s.metaRow}>
                        <Users color={colors.textMuted} size={12} />
                        <Text style={s.meta}>{count} {count === 1 ? 'player' : 'players'} · {teamMatchSportLabel(item.sport)}</Text>
                      </View>
                      {!ok && (
                        <Text style={s.otherSport} numberOfLines={2}>
                          Plays {teamMatchSportLabel(item.sport)} — your team plays {teamMatchSportLabel(sport)}
                        </Text>
                      )}
                    </View>
                    {ok && <Text style={s.pick}>Select</Text>}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={s.empty}>
                  {results ? 'No teams match that name.' : 'No other teams for this sport yet. Post an open challenge instead and any team can take it on.'}
                </Text>
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.5)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 30, minHeight: 420 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  input: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  caption: { fontSize: 11.5, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.6, marginTop: 14, marginBottom: 4, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  logo: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.neutral100 },
  logoEmpty: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { fontSize: 12, color: colors.textMuted },
  pick: { fontSize: 13, fontWeight: '800', color: colors.primary },
  rowDisabled: { opacity: 0.55 },
  otherSport: { fontSize: 11.5, color: colors.warning, fontWeight: '700', marginTop: 3 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 24, paddingHorizontal: 12, lineHeight: 19 },
});
