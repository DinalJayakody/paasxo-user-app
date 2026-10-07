import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, Users, Lock, Globe } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { InputField } from '../components/InputField';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';
import { SPORTS } from '../constants/sports';
import { communityApi } from '../api/communityApi';
import { extractApiError } from '../utils/apiError';
import { goBack } from '../utils/navigation';

// Same header/card/chip visual language as CreateTeamScreen — a Community is
// created once here, then managed (feed, requests, membership) from
// CommunityDetailScreen.
export default function CreateCommunityScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarAsset, setAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const pickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to add a community photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        setAvatarAsset(result.assets[0]);
      }
    } catch (err: any) {
      Alert.alert('Could not open photo library', err?.message || 'Please try again.');
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Give your community a name');
      return;
    }
    setError(undefined);
    setCreating(true);
    try {
      const community = await communityApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        sport: sport || undefined,
        isPrivate,
        avatar: avatarAsset
          ? { uri: avatarAsset.uri, fileName: avatarAsset.fileName || 'avatar.jpg', mimeType: avatarAsset.mimeType || 'image/jpeg' }
          : undefined,
      });
      router.replace(`/community/${community.id}` as any);
    } catch (err: any) {
      setError(extractApiError(err, 'Could not create your community. Please try again.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenGlow />
      <View style={styles.topHeaderShadow}>
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGlassStroke} pointerEvents="none" />

          <HeaderIconButton onPress={() => goBack(router)} style={styles.headerIconBtn} hitSlop={8}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
          </HeaderIconButton>
          <Text style={styles.title}>Create Community</Text>
          <Pressable
            onPress={handleCreate}
            disabled={creating}
            style={[styles.saveBtn, creating && styles.saveBtnDisabled]}
          >
            {creating ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Create</Text>
            )}
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <Pressable onPress={pickAvatar}>
              <View style={styles.logoWrap}>
                {avatarAsset ? (
                  <Image source={{ uri: avatarAsset.uri }} style={styles.logo} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Users color={colors.primary} size={32} strokeWidth={1.8} />
                  </View>
                )}
                <View style={styles.logoCameraBadge}>
                  <Camera color={colors.white} size={15} strokeWidth={2.4} />
                </View>
              </View>
            </Pressable>
            <Pressable onPress={pickAvatar}>
              <Text style={styles.changeLogoText}>{avatarAsset ? 'Change Photo' : 'Add Community Photo (optional)'}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>COMMUNITY NAME</Text>
            <InputField
              placeholder="e.g. Colombo Futsal Club"
              value={name}
              onChangeText={setName}
              maxLength={60}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>DESCRIPTION (OPTIONAL)</Text>
            <InputField
              placeholder="What's this community about?"
              value={description}
              onChangeText={setDescription}
              maxLength={300}
              multiline
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>SPORT (OPTIONAL)</Text>
            <View style={styles.chipsGrid}>
              {SPORTS.map((s) => {
                const Icon = s.icon;
                const active = sport === s.id;
                return (
                  <Pressable
                    key={s.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSport(active ? null : s.id)}
                  >
                    <Icon color={active ? colors.primary : colors.textSecondary} size={14} strokeWidth={2} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.privacyRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                {isPrivate ? (
                  <Lock color={colors.primary} size={18} strokeWidth={2} />
                ) : (
                  <Globe color={colors.primary} size={18} strokeWidth={2} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyTitle}>{isPrivate ? 'Private Community' : 'Public Community'}</Text>
                  <Text style={styles.privacySubtext}>
                    {isPrivate
                      ? 'You approve every join request'
                      : 'Anyone can join instantly'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: colors.neutral200, true: colors.logoBlue || colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </View>

          <Text style={styles.hint}>You'll be the community's creator and admin, and can post, share matches/reels, and manage join requests right away.</Text>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topHeaderShadow: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 2,
    borderRadius: 26,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 26,
    overflow: 'hidden',
  },
  headerGlassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.white },
  saveBtn: {
    paddingHorizontal: 20, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white,
    minWidth: 72,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: colors.primary, fontSize: 14, fontWeight: '800' },

  scroll: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 8 },

  logoSection: { alignItems: 'center', marginBottom: 20 },
  logoWrap: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: colors.white, backgroundColor: colors.neutral100,
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  logo: { width: '100%', height: '100%', borderRadius: 46 },
  logoPlaceholder: {
    width: '100%', height: '100%', borderRadius: 46,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '14',
  },
  logoCameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: colors.white,
  },
  changeLogoText: { marginTop: 10, fontSize: 13, fontWeight: '700', color: colors.primary },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 10.5, fontWeight: '700', letterSpacing: 1.4,
    color: colors.neutral500, textTransform: 'uppercase', marginBottom: 12,
  },

  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1.5, borderColor: colors.neutral200, backgroundColor: colors.tagBg,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.tagBgSelected },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.primary },

  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  privacyTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  privacySubtext: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: 8 },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center', marginTop: 12 },
});
