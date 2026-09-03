import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, CreditCard, Shield, CheckCircle } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/Button';
import ScreenGlow from '../components/ScreenGlow';
import axiosInstance from '../api/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONE_TIME_CREDIT_KEY = 'paasxo_one_time_credit';

export default function OneTimePaymentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCard = (v: string) =>
    v.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);

  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const handlePay = async () => {
    if (!cardName || cardNumber.replace(/\s/g, '').length < 16 || expiry.length < 5 || cvv.length < 3) {
      Alert.alert('Incomplete Details', 'Please fill in all card details.');
      return;
    }
    setLoading(true);
    try {
      // Call backend to register a one-time credit
      await axiosInstance.post('/subscriptions/one-time', {
        paymentReference: `OTP_${cardNumber.slice(-4)}_${Date.now()}`,
      });
      // Store locally so the gate knows we have a credit this session
      await AsyncStorage.setItem(ONE_TIME_CREDIT_KEY, String(Date.now()));
      Alert.alert('Payment Successful!', 'You can now create one event.', [
        { text: 'Continue', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Payment Failed', 'Please try again or choose a subscription.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenGlow />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color={colors.primary} size={22} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>One-time Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[colors.neutral800, colors.neutral900]} style={styles.hero}>
          <CreditCard color={colors.warning} size={32} strokeWidth={1.8} />
          <Text style={styles.heroTitle}>Single Event Access</Text>
          <Text style={styles.heroDesc}>Pay LKR 2.99 once to create one match or tournament. No subscription required.</Text>
        </LinearGradient>

        <View style={styles.featureList}>
          {['Create one match or tournament', 'Valid for 48 hours', 'No recurring charge', 'Secure payment'].map((f) => (
            <View key={f} style={styles.featureRow}>
              <CheckCircle color={colors.success} size={16} strokeWidth={2} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>CARDHOLDER NAME</Text>
          <TextInput style={styles.input} placeholder="John Smith" value={cardName} onChangeText={setCardName} autoCapitalize="words" />
          <Text style={styles.label}>CARD NUMBER</Text>
          <TextInput style={styles.input} placeholder="0000 0000 0000 0000" value={cardNumber}
            onChangeText={(v) => setCardNumber(formatCard(v))} keyboardType="number-pad" maxLength={19} />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>EXPIRY</Text>
              <TextInput style={styles.input} placeholder="MM/YY" value={expiry}
                onChangeText={(v) => setExpiry(formatExpiry(v))} keyboardType="number-pad" maxLength={5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>CVV</Text>
              <TextInput style={styles.input} placeholder="123" value={cvv}
                onChangeText={setCvv} keyboardType="number-pad" maxLength={4} secureTextEntry />
            </View>
          </View>
          <Text style={styles.secure}>
            <Shield color={colors.success} size={11} strokeWidth={2} /> Secured by 256-bit encryption
          </Text>
        </View>

        <Button title={loading ? 'Processing…' : 'Pay LKR 2.99'} onPress={handlePay} loading={loading} style={{ marginBottom: 16 }} />
        <TouchableOpacity onPress={() => router.push('/subscription' as any)} activeOpacity={0.7} style={styles.subLink}>
          <Text style={styles.subLinkText}>Want unlimited access? View subscription plans →</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: { borderRadius: 20, padding: 22, alignItems: 'center', gap: 10, marginBottom: 20 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: colors.white },
  heroDesc: { fontSize: 13, color: colors.neutral300, textAlign: 'center', lineHeight: 20 },
  featureList: { marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  featureText: { fontSize: 14, color: colors.text },
  card: {
    backgroundColor: colors.cardBg, borderRadius: 20, padding: 18, marginBottom: 20, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.neutral500, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: colors.neutral200, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, backgroundColor: colors.inputBg,
  },
  row: { flexDirection: 'row' },
  secure: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
  subLink: { alignItems: 'center' },
  subLinkText: { fontSize: 13, color: colors.primary, fontWeight: '600', textAlign: 'center' },
});
