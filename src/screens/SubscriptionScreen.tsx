import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Zap, CheckCircle, CreditCard, Shield, Star } from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { Button } from '../components/Button';
import { useSubscription } from '../hooks/useSubscription';

const FEATURES = [
  'Create unlimited matches & tournaments',
  'Access scoring & live match updates',
  'Priority venue booking',
  'Trainer session management',
  'Exclusive community badges',
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const { active, plan, endDate, startTrial, activate, refresh } = useSubscription();

  const [mode, setMode] = useState<'plans' | 'payment'>('plans');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCard = (val: string) =>
    val.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  const handleTrial = async () => {
    setLoading(true);
    const ok = await startTrial();
    setLoading(false);
    if (ok) {
      Alert.alert('Free Trial Activated!', 'You now have 1 month of full access. Enjoy Paasxo!', [
        { text: 'Let\'s Go!', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Already Subscribed', 'A subscription already exists on this account.');
    }
  };

  const handlePay = async () => {
    if (!cardName || cardNumber.replace(/\s/g, '').length < 16 || expiry.length < 5 || cvv.length < 3) {
      Alert.alert('Incomplete Details', 'Please fill in all card details.');
      return;
    }
    setLoading(true);
    const ok = await activate(`CARD_${cardNumber.slice(-4)}_${Date.now()}`);
    setLoading(false);
    if (ok) {
      Alert.alert('Subscribed!', 'You are now a Paasxo Pro member!', [
        { text: 'Awesome!', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Payment Failed', 'Unable to process your payment. Please try again.');
    }
  };

  const badgeLabel = !active ? null : plan === 'TRIAL' ? 'Free Trial' : 'Pro Member';
  const badgeColor = plan === 'TRIAL' ? Colors.warning : Colors.primary;

  if (active) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft color={Colors.primary} size={22} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Subscription</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.activeBanner}>
            <Zap color={Colors.warning} size={32} strokeWidth={2.5} fill={Colors.warning} />
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
              <CheckCircle color={Colors.success} size={18} strokeWidth={2} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color={Colors.primary} size={22} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Unlock Full Access</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {mode === 'plans' ? (
          <>
            <LinearGradient colors={[Colors.neutral800, Colors.neutral900]} style={styles.heroBanner}>
              <Zap color={Colors.warning} size={28} strokeWidth={2.5} fill={Colors.warning} />
              <Text style={styles.heroTitle}>Paasxo Pro</Text>
              <Text style={styles.heroSubtitle}>
                Create matches, run tournaments, and access the full platform.
              </Text>
            </LinearGradient>

            <Text style={styles.sectionTitle}>What's included</Text>
            {FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <CheckCircle color={Colors.success} size={18} strokeWidth={2} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}

            {/* Free trial option */}
            <View style={styles.planCard}>
              <View style={styles.planCardHeader}>
                <Star color={Colors.warning} size={20} strokeWidth={2} />
                <Text style={styles.planCardTitle}>1-Month Free Trial</Text>
              </View>
              <Text style={styles.planCardDesc}>
                Full access for 30 days, no payment required upfront.
              </Text>
              <Button
                title={loading ? 'Activating…' : 'Start Free Trial'}
                onPress={handleTrial}
                loading={loading}
                style={styles.planBtn}
              />
            </View>

            {/* Paid plan */}
            <View style={[styles.planCard, styles.planCardPrimary]}>
              <View style={styles.planCardHeader}>
                <Shield color={Colors.primary} size={20} strokeWidth={2} />
                <Text style={styles.planCardTitle}>Monthly — £9.99 / mo</Text>
              </View>
              <Text style={styles.planCardDesc}>
                Full access, auto-renews monthly. Cancel anytime.
              </Text>
              <Button
                title="Subscribe Now"
                onPress={() => setMode('payment')}
                style={styles.planBtn}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.card}>
              <CreditCard color={Colors.primary} size={24} strokeWidth={2} />
              <Text style={styles.payLabel}>CARDHOLDER NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="John Smith"
                value={cardName}
                onChangeText={setCardName}
                autoCapitalize="words"
              />
              <Text style={styles.payLabel}>CARD NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChangeText={(v) => setCardNumber(formatCard(v))}
                keyboardType="number-pad"
                maxLength={19}
              />
              <View style={styles.cardRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.payLabel}>EXPIRY</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="MM/YY"
                    value={expiry}
                    onChangeText={(v) => setExpiry(formatExpiry(v))}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payLabel}>CVV</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123"
                    value={cvv}
                    onChangeText={setCvv}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>
              <Text style={styles.secureNote}>
                <Shield color={Colors.success} size={12} strokeWidth={2} /> Secured by 256-bit encryption
              </Text>
            </View>

            <Button
              title={loading ? 'Processing…' : 'Pay £9.99 / month'}
              onPress={handlePay}
              loading={loading}
              style={{ marginBottom: 12 }}
            />
            <TouchableOpacity onPress={() => setMode('plans')} activeOpacity={0.7} style={styles.backLink}>
              <Text style={styles.backLinkText}>← Back to plans</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  heroBanner: {
    borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, marginBottom: 24,
  },
  heroTitle: { fontSize: 26, fontWeight: '900', color: Colors.white },
  heroSubtitle: { fontSize: 13, color: Colors.neutral300, textAlign: 'center', lineHeight: 20 },

  activeBanner: {
    borderRadius: 20, padding: 28, alignItems: 'center', gap: 10, marginBottom: 24,
  },
  activePlan: { fontSize: 22, fontWeight: '900', color: Colors.white },
  badge: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: Colors.white, letterSpacing: 1 },
  activeExpiry: { fontSize: 12, color: Colors.white + 'CC' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  featureText: { fontSize: 14, color: Colors.text, flex: 1 },

  planCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  planCardPrimary: { borderWidth: 2, borderColor: Colors.primary },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  planCardTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  planCardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 14 },
  planBtn: { width: '100%' },

  card: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 18, marginBottom: 20,
    gap: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  payLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: Colors.neutral500, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: Colors.neutral200, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text,
    backgroundColor: Colors.inputBg,
  },
  cardRow: { flexDirection: 'row' },
  secureNote: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  backLink: { alignItems: 'center', paddingVertical: 8 },
  backLinkText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
});
