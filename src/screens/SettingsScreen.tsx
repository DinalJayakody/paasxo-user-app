import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable, Alert, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/userApi';

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();

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
    // Placeholder logout flow
    Alert.alert('Logout', 'You have been logged out.');
    router.replace('/sign-in');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.logoBlue || Colors.primary} size={22} />
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
              <ActivityIndicator color={Colors.logoBlue || Colors.primary} />
            ) : (
              <Switch
                value={isPrivate}
                onValueChange={handleTogglePrivacy}
                trackColor={{ false: Colors.neutral200, true: Colors.logoBlue || Colors.primary }}
                thumbColor={Colors.white}
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
          <Pressable onPress={() => {}} style={styles.row}>
            <Text style={styles.rowText}>Contact HelpDesk</Text>
          </Pressable>
        </View>

        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '900', color: Colors.neutral900 },
  content: { padding: 16 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 12, marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: Colors.neutral700, marginBottom: 8 },
  row: { paddingVertical: 10 },
  rowText: { color: Colors.neutral900, fontWeight: '700' },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  privacyTextWrap: { flex: 1 },
  privacySubtext: { color: Colors.neutral500, fontSize: 12, fontWeight: '500', marginTop: 3 },
  logoutButton: {
    marginTop: 20,
    backgroundColor: Colors.logoBlue || Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  logoutText: { color: Colors.white, fontWeight: '900' },
});
