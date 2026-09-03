import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable, Alert, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { userApi } from '../api/userApi';
import ScreenGlow from '../components/ScreenGlow';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isPrivate, setIsPrivate] = useState(!!user?.isPrivate);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    userApi.getProfile()
      .then((profile) => setIsPrivate(!!profile?.isPrivate))
      .catch(() => {});
  }, []);

  const handleTogglePrivacy = async (value: boolean) => {
    setIsPrivate(value);
    setSavingPrivacy(true);
    try {
      await userApi.updatePrivacy(value);
    } catch {
      setIsPrivate(!value);
      Alert.alert('Something went wrong', 'Could not update your privacy setting. Please try again.');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/sign-in');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.logoBlue || colors.primary} size={22} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Pressable onPress={() => router.push('/profile')} style={styles.row}>
            <Text style={styles.rowText}>View profile</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/saved-posts')} style={styles.row}>
            <Text style={styles.rowText}>Saved posts</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Appearance</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const selected = mode === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.themeOption, selected && styles.themeOptionSelected]}
                  onPress={() => setMode(opt.value)}
                >
                  {selected && <Check color={colors.white} size={13} strokeWidth={3} />}
                  <Text style={[styles.themeOptionText, selected && styles.themeOptionTextSelected]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Privacy</Text>
          <View style={styles.privacyRow}>
            <View style={styles.privacyTextWrap}>
              <Text style={styles.rowText}>Private Account</Text>
              <Text style={styles.privacySubtext}>
                Approve who can follow you and see your posts
              </Text>
            </View>
            {savingPrivacy ? (
              <ActivityIndicator color={colors.logoBlue || colors.primary} />
            ) : (
              <Switch
                value={isPrivate}
                onValueChange={handleTogglePrivacy}
                trackColor={{ false: colors.neutral200, true: colors.logoBlue || colors.primary }}
                thumbColor={colors.white}
              />
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security</Text>
          <Pressable onPress={() => {}} style={styles.row}>
            <Text style={styles.rowText}>Change password</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support</Text>
          <Pressable onPress={() => router.push('/support')} style={styles.row}>
            <Text style={styles.rowText}>Contact & Help Center</Text>
          </Pressable>
        </View>

        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '900', color: colors.neutral900 },
  content: { padding: 16 },
  card: { backgroundColor: colors.cardBg, borderRadius: 14, padding: 12, marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.neutral700, marginBottom: 8 },
  row: { paddingVertical: 10 },
  rowText: { color: colors.neutral900, fontWeight: '700' },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, backgroundColor: colors.inputBg,
  },
  themeOptionSelected: { backgroundColor: colors.logoBlue || colors.primary },
  themeOptionText: { fontSize: 13, fontWeight: '700', color: colors.neutral700 },
  themeOptionTextSelected: { color: colors.white },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  privacyTextWrap: { flex: 1 },
  privacySubtext: { color: colors.neutral500, fontSize: 12, fontWeight: '500', marginTop: 3 },
  logoutButton: {
    marginTop: 20,
    backgroundColor: colors.logoBlue || colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  logoutText: { color: colors.white, fontWeight: '900' },
});
