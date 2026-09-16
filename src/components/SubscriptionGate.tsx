import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Zap, CreditCard, ArrowLeft } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../hooks/useSubscription';
import { goBack } from '../utils/navigation';

interface Props {
  children: React.ReactNode;
  feature?: string;
}

export function SubscriptionGate({ children, feature = 'this feature' }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { active, loading } = useSubscription();
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!active) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity
          style={styles.closeBtn}
          activeOpacity={0.8}
          onPress={() => goBack(router)}
          hitSlop={8}
        >
          <ArrowLeft color={colors.text} size={20} strokeWidth={2.5} />
        </TouchableOpacity>
        {/* Fixed dark gradient (not theme-reactive) — colors.neutral800/900 flip
            to near-white in dark mode (they're text-oriented tokens elsewhere),
            which would turn this into a white card with invisible white text. */}
        <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.card}>
          <Lock color={colors.warning} size={36} strokeWidth={1.8} />
          <Text style={styles.title}>Pro Feature</Text>
          <Text style={styles.subtitle}>
            A Paasxo Pro subscription is required to access {feature}.{'\n'}
            Choose how you'd like to proceed:
          </Text>

          {/* Option 1 — Subscribe monthly */}
          <TouchableOpacity
            style={styles.optionBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/subscription' as any)}
          >
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.optionGrad}>
              <Zap color={colors.warning} size={18} strokeWidth={2.5} fill={colors.warning} />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Subscribe — LKR 9.99 / mo</Text>
                <Text style={styles.optionDesc}>Full access + 1-month free trial available</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Option 2 — One-time payment */}
          <TouchableOpacity
            style={[styles.optionBtn, { marginTop: 10 }]}
            activeOpacity={0.85}
            onPress={() => router.push('/one-time-payment' as any)}
          >
            <View style={styles.optionOutline}>
              <CreditCard color={colors.white} size={18} strokeWidth={2} />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>One-time Payment — LKR 2.99</Text>
                <Text style={styles.optionDesc}>Single event creation, no commitment</Text>
              </View>
            </View>
          </TouchableOpacity>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: colors.background },
  closeBtn: {
    position: 'absolute', top: 16, left: 16, zIndex: 1,
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cardBg,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  card: {
    borderRadius: 24, padding: 26, alignItems: 'center', gap: 12, width: '100%',
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.white },
  subtitle: {
    fontSize: 13, color: '#CBD5E1', textAlign: 'center', lineHeight: 20,
  },
  optionBtn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  optionGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  optionOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 16,
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: '800', color: colors.white },
  optionDesc: { fontSize: 11, color: '#CBD5E1', marginTop: 2 },
});
