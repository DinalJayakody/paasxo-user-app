import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Zap, CheckCircle, Shield, Star } from 'lucide-react-native';
import { useIAP, ErrorCode, type Purchase } from 'react-native-iap';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/Button';
import { useSubscription } from '../hooks/useSubscription';
import { extractApiError } from '../utils/apiError';
import { PAASXO_PRO_MONTHLY_PRODUCT_ID } from '../constants/iap';
import ScreenGlow from '../components/ScreenGlow';
import { goBack } from '../utils/navigation';

const FEATURES = [
  'Create unlimited matches & tournaments',
  'Access scoring & live match updates',
  'Priority venue booking',
  'Trainer session management',
  'Exclusive community badges',
];

// Paasxo Pro unlocks digital, in-app-only features (unlimited matches, live
// scoring, priority booking, badges) - Apple Guideline 3.1.1 and Google
// Play's equivalent policy both require this to go through the platform's
// own billing (StoreKit / Play Billing), not a card form or PayHere. That's
// what this screen does via react-native-iap, which wraps both under one API.
// Real-world bookings (futsal courts, trainer sessions) are unaffected and
// keep using PayHere elsewhere in the app - they're correctly exempt.
export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { active, plan, endDate, startTrial, verifyPurchase, refresh } = useSubscription();

  const [trialLoading, setTrialLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      await handlePurchaseSuccess(purchase);
    },
    onPurchaseError: (error) => {
      setPurchaseLoading(false);
      // The user backing out of the native purchase sheet isn't worth surfacing as an error.
      if (error?.code !== ErrorCode.UserCancelled) {
        Alert.alert('Purchase Failed', error?.message || 'Something went wrong. Please try again.');
      }
    },
  });

  // This screen shows a "Choose a plan" UI for inactive users, so a stale
  // cached `active: false` would let someone try to subscribe again — always
  // re-check against the server when the screen is opened/returned to.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (!connected) return;
    fetchProducts({ skus: [PAASXO_PRO_MONTHLY_PRODUCT_ID], type: 'subs' }).catch(() => {});
  }, [connected, fetchProducts]);

  const handleTrial = async () => {
    setTrialLoading(true);
    try {
      await startTrial();
      Alert.alert('Free Trial Activated!', 'You now have 1 month of full access. Enjoy Paasxo!', [
        { text: 'Let\'s Go!', onPress: () => goBack(router) },
      ]);
    } catch (err) {
      Alert.alert('Could Not Start Trial', extractApiError(err));
    } finally {
      setTrialLoading(false);
    }
  };

  const handlePurchaseSuccess = async (purchase: Purchase) => {
    setPurchaseLoading(false);
    setVerifying(true);
    try {
      const platform = purchase.store === 'apple' ? 'APPLE' : 'GOOGLE';
      await verifyPurchase({
        platform,
        productId: purchase.productId,
        transactionId: platform === 'APPLE' ? (purchase as any).transactionId : undefined,
        purchaseToken: platform === 'GOOGLE' ? purchase.purchaseToken ?? undefined : undefined,
      });
      // Only finish (acknowledge) the transaction once our own backend has
      // confirmed it - an unfinished iOS transaction safely replays on next
      // launch, and an unfinished Android one auto-refunds after 3 days rather
      // than silently granting access nothing actually verified.
      await finishTransaction({ purchase, isConsumable: false });
      Alert.alert('Subscribed!', 'You are now a Paasxo Pro member!', [
        { text: 'Awesome!', onPress: () => goBack(router) },
      ]);
    } catch (err) {
      Alert.alert(
        'Could Not Verify Purchase',
        extractApiError(err, 'Your purchase went through with the store but we could not verify it yet. Contact support if this persists — your payment is safe either way.')
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleSubscribe = async () => {
    if (!connected) {
      Alert.alert('Store Unavailable', 'Could not connect to the App Store / Play Store. Please try again shortly.');
      return;
    }
    const product = subscriptions.find((s) => s.id === PAASXO_PRO_MONTHLY_PRODUCT_ID);
    if (!product) {
      Alert.alert(
        'Not Available Yet',
        'This subscription is not set up on the store yet. Please check back soon.'
      );
      return;
    }
    setPurchaseLoading(true);
    try {
      if (Platform.OS === 'ios') {
        await requestPurchase({
          request: { apple: { sku: PAASXO_PRO_MONTHLY_PRODUCT_ID } },
          type: 'subs',
        });
      } else {
        const offerToken = (product as any).subscriptionOffers?.[0]?.offerTokenAndroid;
        await requestPurchase({
          request: {
            google: {
              skus: [PAASXO_PRO_MONTHLY_PRODUCT_ID],
              subscriptionOffers: offerToken
                ? [{ sku: PAASXO_PRO_MONTHLY_PRODUCT_ID, offerToken }]
                : undefined,
            },
          },
          type: 'subs',
        });
      }
      // Result arrives via onPurchaseSuccess/onPurchaseError above, not here.
    } catch (err: any) {
      setPurchaseLoading(false);
      if (err?.code !== ErrorCode.UserCancelled) {
        Alert.alert('Purchase Failed', err?.message || 'Something went wrong. Please try again.');
      }
    }
  };

  const displayPrice = useMemo(() => {
    const product = subscriptions.find((s) => s.id === PAASXO_PRO_MONTHLY_PRODUCT_ID);
    return product?.displayPrice || null;
  }, [subscriptions]);

  const badgeLabel = !active ? null : plan === 'TRIAL' ? 'Free Trial' : 'Pro Member';
  const badgeColor = plan === 'TRIAL' ? colors.warning : colors.primary;
  const busy = purchaseLoading || verifying;

  if (active) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenGlow />
        <View style={styles.header}>
          <Pressable onPress={() => goBack(router)} style={styles.backBtn}>
            <ArrowLeft color={colors.primary} size={22} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.headerTitle}>Subscription</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.activeBanner}>
            <Zap color={colors.warning} size={32} strokeWidth={2.5} fill={colors.warning} />
            <Text style={styles.activePlan}>{badgeLabel}</Text>
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={styles.badgeText}>{badgeLabel?.toUpperCase()}</Text>
            </View>
            {endDate && (
              <Text style={styles.activeExpiry}>
                Valid until {new Date(endDate).toLocaleDateString()}
              </Text>
            )}
          </LinearGradient>

          <Text style={styles.sectionTitle}>Your Benefits</Text>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <CheckCircle color={colors.success} size={18} strokeWidth={2} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenGlow />
      <View style={styles.header}>
        <Pressable onPress={() => goBack(router)} style={styles.backBtn}>
          <ArrowLeft color={colors.primary} size={22} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>Unlock Full Access</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Fixed dark gradient (not theme-reactive) — colors.neutral800/900 flip
            to near-white in dark mode (they're text-oriented tokens elsewhere),
            which would turn this into a white banner with invisible white text. */}
        <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.heroBanner}>
          <Zap color={colors.warning} size={28} strokeWidth={2.5} fill={colors.warning} />
          <Text style={styles.heroTitle}>Paasxo Pro</Text>
          <Text style={styles.heroSubtitle}>
            Create matches, run tournaments, and access the full platform.
          </Text>
        </LinearGradient>

        <Text style={styles.sectionTitle}>What's included</Text>
        {FEATURES.map((f) => (
          <View key={f} style={styles.featureRow}>
            <CheckCircle color={colors.success} size={18} strokeWidth={2} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}

        {/* Free trial option */}
        <View style={styles.planCard}>
          <View style={styles.planCardHeader}>
            <Star color={colors.warning} size={20} strokeWidth={2} />
            <Text style={styles.planCardTitle}>1-Month Free Trial</Text>
          </View>
          <Text style={styles.planCardDesc}>
            Full access for 30 days, no payment required upfront.
          </Text>
          <Button
            title={trialLoading ? 'Activating…' : 'Start Free Trial'}
            onPress={handleTrial}
            loading={trialLoading}
            disabled={busy}
            style={styles.planBtn}
          />
        </View>

        {/* Paid plan - via Apple/Google's own billing, required for digital in-app perks */}
        <View style={[styles.planCard, styles.planCardPrimary]}>
          <View style={styles.planCardHeader}>
            <Shield color={colors.primary} size={20} strokeWidth={2} />
            <Text style={styles.planCardTitle}>
              Monthly{displayPrice ? ` — ${displayPrice}` : ''}
            </Text>
          </View>
          <Text style={styles.planCardDesc}>
            Full access, auto-renews monthly. Cancel anytime from your{' '}
            {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account settings.
          </Text>
          {busy ? (
            <View style={styles.planBtnLoading}>
              <ActivityIndicator color={colors.white} size="small" />
              <Text style={styles.planBtnLoadingText}>
                {verifying ? 'Confirming your purchase…' : 'Opening checkout…'}
              </Text>
            </View>
          ) : (
            <Button title="Subscribe Now" onPress={handleSubscribe} style={styles.planBtn} />
          )}
          <Text style={styles.secureNote}>
            <Shield color={colors.success} size={12} strokeWidth={2} />{' '}
            Charged through {Platform.OS === 'ios' ? 'the App Store' : 'Google Play'} — Paasxo never
            sees your card details.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  heroBanner: {
    borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, marginBottom: 24,
  },
  heroTitle: { fontSize: 26, fontWeight: '900', color: colors.white },
  heroSubtitle: { fontSize: 13, color: '#CBD5E1', textAlign: 'center', lineHeight: 20 },

  activeBanner: {
    borderRadius: 20, padding: 28, alignItems: 'center', gap: 10, marginBottom: 24,
  },
  activePlan: { fontSize: 22, fontWeight: '900', color: colors.white },
  badge: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.white, letterSpacing: 1 },
  activeExpiry: { fontSize: 12, color: colors.white + 'CC' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  featureText: { fontSize: 14, color: colors.text, flex: 1 },

  planCard: {
    backgroundColor: colors.cardBg, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  planCardPrimary: { borderWidth: 2, borderColor: colors.primary },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  planCardTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  planCardDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 14 },
  planBtn: { width: '100%' },
  planBtnLoading: {
    height: 54, borderRadius: 999, backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  planBtnLoadingText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  secureNote: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 10 },
});
