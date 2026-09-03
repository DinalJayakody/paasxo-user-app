import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, MapPin, Phone, User } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { InputField } from '../components/InputField';
import { AvatarActionSheet } from '../components/AvatarActionSheet';
import { FullScreenImageViewer } from '../components/FullScreenImageViewer';
import HeaderIconButton from '../components/HeaderIconButton';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/userApi';
import { resolveAvatarUri } from '../utils/mediaUrl';
import { SPORTS } from '../constants/sports';
import ScreenGlow from '../components/ScreenGlow';

const SKILL_LEVELS: { id: string; label: string }[] = [
  { id: 'BEGINNER', label: 'Beginner' },
  { id: 'INTERMEDIATE', label: 'Intermediate' },
  { id: 'PRO', label: 'Pro' },
];

const BIO_MAX_LENGTH = 150;

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const initialSports = useMemo(() => {
    if (Array.isArray(user?.sports) && user.sports.length) return user.sports.map((s) => s.toUpperCase());
    if (Array.isArray(user?.sport)) return user.sport.map((s) => s.toUpperCase());
    if (typeof user?.sport === 'string' && user.sport) return [user.sport.toUpperCase()];
    return [];
  }, [user]);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [selectedSports, setSelectedSports] = useState<string[]>(initialSports);
  const [skillLevel, setSkillLevel] = useState(user?.skillLevel ? user.skillLevel.toUpperCase() : 'BEGINNER');
  const [locationAccess, setLocationAccess] = useState(!!user?.locationAccess);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // A newly picked/taken photo is only previewed locally - it's uploaded
  // together with the rest of the form in one request when Save is pressed,
  // not the moment it's picked (see handleSave).
  const [pendingAvatarAsset, setPendingAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);
  const [avatarViewerVisible, setAvatarViewerVisible] = useState(false);

  const saveScale = useRef(new Animated.Value(1)).current;

  const profileImageUri = useMemo(
    () => (pendingAvatarAsset ? pendingAvatarAsset.uri : resolveAvatarUri(user?.profileImageUrl, user?.displayName)),
    [user, pendingAvatarAsset]
  );

  const toggleSport = (id: string) => {
    setSelectedSports((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  // ── Avatar change (preview only - the actual upload happens on Save) ────

  const handleChooseFromLibrary = () => {
    setAvatarSheetVisible(false);
    (async () => {
      try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Allow photo library access to change your profile picture.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) setPendingAvatarAsset(result.assets[0]);
      } catch (err: any) {
        Alert.alert('Could not open photo library', err?.message || 'Please try again.');
      }
    })();
  };

  const handleTakePhoto = () => {
    setAvatarSheetVisible(false);
    (async () => {
      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission needed', 'Allow camera access to take a new profile picture.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.85 });
        if (!result.canceled && result.assets[0]) setPendingAvatarAsset(result.assets[0]);
      } catch (err: any) {
        Alert.alert('Could not open camera', err?.message || 'Please try again.');
      }
    })();
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (selectedSports.length === 0) {
      setError('Select at least one activity');
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      const updated = await userApi.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        phoneNumber: phoneNumber.trim(),
        sports: selectedSports,
        skillLevel,
        locationAccess,
        profileImage: pendingAvatarAsset
          ? {
              uri: pendingAvatarAsset.uri,
              name: pendingAvatarAsset.fileName || 'avatar.jpg',
              type: pendingAvatarAsset.mimeType || 'image/jpeg',
            }
          : undefined,
      });
      await updateUser(updated);
      setPendingAvatarAsset(null);
      router.back();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const animateSave = (toValue: number) => {
    Animated.spring(saveScale, { toValue, useNativeDriver: true, friction: 12, tension: 160 }).start();
  };

  return (
    <>
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenGlow />
      {/* Floating glass-gradient header */}
      <View style={styles.topHeaderShadow}>
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGlassStroke} pointerEvents="none" />

          <HeaderIconButton onPress={() => router.back()} style={styles.headerIconBtn} hitSlop={8}>
            <ArrowLeft color={colors.white} size={20} strokeWidth={2.2} />
          </HeaderIconButton>
          <Text style={styles.title}>Edit Profile</Text>
          <Animated.View style={{ transform: [{ scale: saveScale }] }}>
            <Pressable
              onPress={handleSave}
              onPressIn={() => animateSave(0.94)}
              onPressOut={() => animateSave(1)}
              disabled={saving}
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            >
              {saving ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable onPress={() => setAvatarSheetVisible(true)}>
              <View style={styles.avatarWrap}>
                <Image source={{ uri: profileImageUri }} style={styles.avatar} />
                <View style={styles.avatarCameraBadge}>
                  <Camera color={colors.white} size={15} strokeWidth={2.4} />
                </View>
              </View>
            </Pressable>
            <Pressable onPress={() => setAvatarSheetVisible(true)}>
              <Text style={styles.changePhotoText}>
                {pendingAvatarAsset ? 'Change Photo Again' : 'Change Profile Photo'}
              </Text>
            </Pressable>
            {pendingAvatarAsset && (
              <View style={styles.pendingBadge}>
                <View style={styles.pendingDot} />
                <Text style={styles.pendingBadgeText}>New photo ready — tap Save to apply</Text>
              </View>
            )}
          </View>

          {/* Basic info */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>BASIC INFO</Text>
            <InputField
              placeholder="Your name"
              value={displayName}
              onChangeText={setDisplayName}
              leftIcon={<User color={colors.neutral400} size={18} />}
              containerStyle={styles.fieldGap}
            />
            <InputField
              placeholder="Phone number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              leftIcon={<Phone color={colors.neutral400} size={18} />}
            />
          </View>

          {/* Bio */}
          <View style={styles.card}>
            <View style={styles.bioHeaderRow}>
              <Text style={styles.sectionLabel}>BIO</Text>
              <Text style={styles.bioCounter}>{bio.length}/{BIO_MAX_LENGTH}</Text>
            </View>
            <TextInput
              style={styles.bioInput}
              placeholder="Tell other players about yourself..."
              placeholderTextColor={colors.textMuted}
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, BIO_MAX_LENGTH))}
              multiline
              maxLength={BIO_MAX_LENGTH}
              textAlignVertical="top"
            />
          </View>

          {/* Sports */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ACTIVITIES</Text>
            <View style={styles.chipsGrid}>
              {SPORTS.map((sport) => {
                const Icon = sport.icon;
                const active = selectedSports.includes(sport.id);
                return (
                  <Pressable
                    key={sport.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleSport(sport.id)}
                  >
                    <Icon color={active ? colors.primary : colors.textSecondary} size={14} strokeWidth={2} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{sport.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Skill level */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>SKILL LEVEL</Text>
            <View style={styles.chipsGrid}>
              {SKILL_LEVELS.map((level) => {
                const active = skillLevel === level.id;
                return (
                  <Pressable
                    key={level.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSkillLevel(level.id)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{level.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Location */}
          <View style={[styles.card, styles.locationRow]}>
            <View style={styles.locationLeft}>
              <View style={styles.locationIconWrap}>
                <MapPin color={colors.primary} size={18} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>Location Access</Text>
                <Text style={styles.locationSubtitle}>Find nearby games and players</Text>
              </View>
            </View>
            <Switch
              value={locationAccess}
              onValueChange={setLocationAccess}
              trackColor={{ false: colors.neutral200, true: colors.primaryLight }}
              thumbColor={locationAccess ? colors.primary : colors.white}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>

    {/* Rendered outside the SafeAreaView so its own inset handling isn't
        double-applied on top of the screen's already-inset safe area. */}
    <AvatarActionSheet
      visible={avatarSheetVisible}
      onClose={() => setAvatarSheetVisible(false)}
      onViewPhoto={() => {
        setAvatarSheetVisible(false);
        setAvatarViewerVisible(true);
      }}
      onChooseLibrary={handleChooseFromLibrary}
      onTakePhoto={handleTakePhoto}
    />
    <FullScreenImageViewer
      visible={avatarViewerVisible}
      imageUri={profileImageUri}
      onClose={() => setAvatarViewerVisible(false)}
    />
    </>
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

  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarWrap: {
    width: 104, height: 104, borderRadius: 52,
    borderWidth: 3, borderColor: colors.white, backgroundColor: colors.neutral100,
    shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 50 },
  avatarCameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: colors.white,
  },
  changePhotoText: { marginTop: 10, fontSize: 13, fontWeight: '700', color: colors.primary },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: colors.success + '18',
  },
  pendingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  pendingBadgeText: { fontSize: 11.5, fontWeight: '700', color: colors.successDark },

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
  fieldGap: { marginBottom: 12 },

  bioHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  bioCounter: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 12 },
  bioInput: {
    minHeight: 88,
    backgroundColor: colors.inputBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
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

  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locationLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
  locationIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  locationTitle: { fontSize: 14, fontWeight: '700', color: colors.neutral900 },
  locationSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  errorText: { color: colors.error, fontSize: 13, textAlign: 'center', marginTop: 4 },
});
