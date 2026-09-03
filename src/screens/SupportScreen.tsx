import React, { useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, LifeBuoy, ChevronRight } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import ScreenGlow from '../components/ScreenGlow';

/**
 * Settings > Support hub — "Contact" and "Help Center" as subcategories,
 * per the client's request.
 */
export default function SupportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.logoBlue || colors.primary} size={22} />
        </Pressable>
        <Text style={styles.title}>Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Pressable onPress={() => router.push('/support/contact')} style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
            <Mail color={colors.primary} size={20} strokeWidth={2} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Contact</Text>
            <Text style={styles.rowSubtitle}>Email, address, phone, and website</Text>
          </View>
          <ChevronRight color={colors.neutral400} size={18} strokeWidth={2} />
        </Pressable>

        <Pressable onPress={() => router.push('/support/help-center')} style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
            <LifeBuoy color={colors.primary} size={20} strokeWidth={2} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Help Center</Text>
            <Text style={styles.rowSubtitle}>FAQs and submit a support ticket</Text>
          </View>
          <ChevronRight color={colors.neutral400} size={18} strokeWidth={2} />
        </Pressable>
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
  content: { padding: 16, gap: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.cardBg, borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.neutral900 },
  rowSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
