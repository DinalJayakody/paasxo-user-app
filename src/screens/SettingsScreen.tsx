import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable, Alert, Switch, ActivityIndicator, Linking, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { userApi } from '../api/userApi';
import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '../constants/legal';
import ScreenGlow from '../components/ScreenGlow';
import { goBack } from '../utils/navigation';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Matches ActivityType on the backend/activity feature exactly (WALK/RUN/
// CYCLING) — see User.hiddenStatsActivityTypes.
const STAT_VISIBILITY_TYPES: { value: string; label: string }[] = [
  { value: 'RUN', label: 'Running' },
  { value: 'WALK', label: 'Walking' },
  { value: 'CYCLING', label: 'Cycling' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, deleteAccount } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isPrivate, setIsPrivate] = useState(!!user?.isPrivate);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [hiddenStatTypes, setHiddenStatTypes] = useState<Set<string>>(new Set(user?.hiddenStatsActivityTypes ?? []));
  const [savingStatType, setSavingStatType] = useState<string | null>(null);

  useEffect(() => {
    userApi.getProfile()
      .then((profile) => {
        setIsPrivate(!!profile?.isPrivate);
        setHiddenStatTypes(new Set(profile?.hiddenStatsActivityTypes ?? []));
      })
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

  // "Visible" (switch ON) is the inverse of "hidden" (what's actually stored)
  // — the toggle reads naturally as "show this on my profile" rather than
  // "hide this," so the ON/OFF sense needs flipping at this one boundary.
  const handleToggleStatVisible = async (type: string, visible: boolean) => {
    const next = new Set(hiddenStatTypes);
    if (visible) next.delete(type); else next.add(type);
    const prev = hiddenStatTypes;
    setHiddenStatTypes(next);
    setSavingStatType(type);
    try {
      await userApi.updateStatsVisibility(Array.from(next));
    } catch {
      setHiddenStatTypes(prev);
      Alert.alert('Something went wrong', 'Could not update your stats visibility. Please try again.');
    } finally {
      setSavingStatType(null);
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

  // Required by App Store Review Guideline 5.1.1(v) — any app offering
  // account creation must offer a way to delete the account from within
  // the app. Two-step confirmation since this is irreversible.
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and you will not be able to recover it. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'All your profile data will be permanently removed. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete My Account',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      await deleteAccount();
                      router.replace('/sign-in');
                    } catch (err: any) {
                      Alert.alert(
                        'Something went wrong',
                        err?.response?.data?.message || err?.message || 'Could not delete your account. Please try again.'
                      );
                    } finally {
                      setDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable onPress={() => goBack(router)} style={styles.backBtn}>
          <ArrowLeft color={colors.logoBlue || colors.primary} size={22} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Pressable onPress={() => router.push('/profile')} style={styles.row}>
            <Text style={styles.rowText}>View profile</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/saved-posts')} style={styles.row}>
            <Text style={styles.rowText}>Saved posts</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/joined-matches')} style={styles.row}>
            <Text style={styles.rowText}>Joined matches</Text>
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
          <Pressable onPress={() => router.push('/blocked-accounts')} style={[styles.row, styles.privacyRowDivider]}>
            <Text style={styles.rowText}>Blocked Accounts</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stats Visibility</Text>
          <Text style={[styles.privacySubtext, { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10 }]}>
            Choose which activity stats show on your public profile. This only affects what others see — you always see your own full stats.
          </Text>
          {STAT_VISIBILITY_TYPES.map((t, idx) => (
            <View key={t.value} style={[styles.privacyRow, idx > 0 && styles.privacyRowDivider]}>
              <View style={styles.privacyTextWrap}>
                <Text style={styles.rowText}>{t.label}</Text>
              </View>
              {savingStatType === t.value ? (
                <ActivityIndicator color={colors.logoBlue || colors.primary} />
              ) : (
                <Switch
                  value={!hiddenStatTypes.has(t.value)}
                  onValueChange={(v) => handleToggleStatVisible(t.value, v)}
                  trackColor={{ false: colors.neutral200, true: colors.logoBlue || colors.primary }}
                  thumbColor={colors.white}
                />
              )}
            </View>
          ))}
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Legal</Text>
          <Pressable onPress={() => Linking.openURL(getPrivacyPolicyUrl())} style={styles.row}>
            <Text style={styles.rowText}>Privacy Policy</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(getTermsOfServiceUrl())} style={styles.row}>
            <Text style={styles.rowText}>Terms of Service</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Danger Zone</Text>
          <Pressable onPress={handleDeleteAccount} style={styles.row} disabled={deletingAccount}>
            {deletingAccount ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <Text style={[styles.rowText, styles.dangerText]}>Delete Account</Text>
            )}
          </Pressable>
        </View>

        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
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
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: colors.cardBg, borderRadius: 14, padding: 12, marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.neutral700, marginBottom: 8 },
  row: { paddingVertical: 10 },
  rowText: { color: colors.neutral900, fontWeight: '700' },
  dangerText: { color: colors.error },
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
  privacyRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral100,
    marginTop: 4,
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
