import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Shield, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { ThemeColors } from '../../styles/colors';
import { Team } from '../../types/api';
import { teamApi } from '../../api/teamApi';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { prepareImageForUpload } from '../../utils/mediaCompression';
import { extractApiError } from '../../utils/apiError';

/** Captain-only: rename the team, change or remove its logo. */
export function EditTeamSheet({
  visible, team, onClose, onSaved,
}: { visible: boolean; team: Team; onClose: () => void; onSaved: (t: Team) => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState(team.name);
  const [logo, setLogo] = useState<{ uri: string } | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setName(team.name); setLogo(null); setRemoveLogo(false); }
  }, [visible, team.name]);

  const currentUri = logo?.uri ?? (removeLogo ? null : resolveMediaUrl(team.logoUrl));
  const trimmed = name.replace(/\s+/g, ' ').trim();
  const changed = trimmed !== team.name || !!logo || removeLogo;
  const valid = trimmed.length >= 2 && trimmed.length <= 60;

  const pickLogo = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to change the team logo.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      const prepared = await prepareImageForUpload(a.uri, a.width, a.height);
      setLogo({ uri: prepared.uri });
      setRemoveLogo(false);
    } catch (e: any) {
      Alert.alert('Could not open photo library', e?.message || 'Please try again.');
    }
  };

  const save = async () => {
    if (!valid || !changed || saving) return;
    setSaving(true);
    try {
      const updated = await teamApi.updateTeam(team.id, {
        name: trimmed !== team.name ? trimmed : undefined,
        removeLogo: removeLogo && !logo ? true : undefined,
        logo: logo ? { uri: logo.uri, name: 'team-logo.jpg', type: 'image/jpeg' } : undefined,
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      Alert.alert('Could not save', extractApiError(e, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.wrap} pointerEvents="box-none">
        <View style={s.sheet}>
          <View style={s.headerRow}>
            <Text style={s.title}>Edit team</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><X color={colors.text} size={20} /></Pressable>
          </View>

          <View style={s.logoRow}>
            <Pressable onPress={pickLogo} style={s.logoWrap} accessibilityRole="button" accessibilityLabel="Change team logo">
              {currentUri ? (
                <Image source={{ uri: currentUri }} style={s.logo} />
              ) : (
                <View style={[s.logo, s.logoEmpty]}><Shield color={colors.primary} size={34} strokeWidth={1.8} /></View>
              )}
              <View style={s.camBadge}><Camera color="#fff" size={14} strokeWidth={2.4} /></View>
            </Pressable>
            <View style={{ flex: 1, gap: 8 }}>
              <Pressable onPress={pickLogo} style={s.smallBtn}><Text style={s.smallBtnText}>{currentUri ? 'Change logo' : 'Add logo'}</Text></Pressable>
              {!!currentUri && (
                <Pressable onPress={() => { setLogo(null); setRemoveLogo(true); }} style={[s.smallBtn, s.smallBtnDanger]}>
                  <Trash2 color={colors.error} size={14} />
                  <Text style={[s.smallBtnText, { color: colors.error }]}>Remove logo</Text>
                </Pressable>
              )}
            </View>
          </View>

          <Text style={s.label}>Team name</Text>
          <TextInput
            value={name}
            onChangeText={(t) => setName(t.slice(0, 60))}
            style={[s.input, !valid && name.length > 0 && { borderColor: colors.error }]}
            placeholder="Team name"
            placeholderTextColor={colors.textMuted}
            maxLength={60}
            autoCapitalize="words"
            returnKeyType="done"
          />
          {!valid && <Text style={s.err}>Use 2–60 characters.</Text>}

          <Pressable
            onPress={save}
            disabled={!valid || !changed || saving}
            style={[s.save, (!valid || !changed || saving) && { opacity: 0.5 }]}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save changes</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.5)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.cardBg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '900', color: colors.text },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 },
  logoWrap: { width: 84, height: 84 },
  logo: { width: 84, height: 84, borderRadius: 24, backgroundColor: colors.neutral100 },
  logoEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primary + '55', borderStyle: 'dashed' },
  camBadge: {
    position: 'absolute', right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.cardBg,
  },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.primary + '14',
  },
  smallBtnDanger: { backgroundColor: colors.error + '14' },
  smallBtnText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  label: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginBottom: 6, letterSpacing: 0.4 },
  input: {
    borderWidth: 1.5, borderColor: colors.inputBorder, borderRadius: 14, backgroundColor: colors.inputBg,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15.5, color: colors.text,
  },
  err: { color: colors.error, fontSize: 12, marginTop: 6 },
  save: { marginTop: 20, height: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
