import React, { useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, MapPin, Phone, Globe } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import ScreenGlow from '../components/ScreenGlow';

// Placeholder contact details — swap for the real business details before
// shipping. www.paasxo.com is the one value already confirmed real elsewhere
// in this codebase (see src/api/endpoints.ts); the rest need to come from
// the business.
const CONTACT = {
  email: 'support@paasxo.com',
  phone: '+94 77 000 0000',
  address: 'Colombo, Sri Lanka',
  website: 'https://www.paasxo.com',
};

export default function ContactScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const rows = [
    { icon: Mail, label: 'Email', value: CONTACT.email, onPress: () => Linking.openURL(`mailto:${CONTACT.email}`) },
    { icon: Phone, label: 'Phone', value: CONTACT.phone, onPress: () => Linking.openURL(`tel:${CONTACT.phone.replace(/\s/g, '')}`) },
    { icon: MapPin, label: 'Address', value: CONTACT.address, onPress: undefined },
    { icon: Globe, label: 'Website', value: CONTACT.website, onPress: () => Linking.openURL(CONTACT.website) },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.logoBlue || colors.primary} size={22} />
        </Pressable>
        <Text style={styles.title}>Contact</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {rows.map((row) => (
          <Pressable
            key={row.label}
            onPress={row.onPress}
            disabled={!row.onPress}
            style={styles.row}
          >
            <View style={styles.rowIcon}>
              <row.icon color={colors.primary} size={18} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: { fontSize: 18, fontWeight: '900', color: colors.neutral900 },
  content: { padding: 16, gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardBg, borderRadius: 14, padding: 14,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.neutral900, marginTop: 2 },
});
