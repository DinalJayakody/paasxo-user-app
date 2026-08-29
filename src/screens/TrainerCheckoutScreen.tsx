import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Calendar, Check, Clock, CreditCard, Lock, MapPin, ShieldCheck, Smartphone, Video,
} from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { trainerApi } from '../api/trainerApi';
import { TrainerBooking, TrainerCategory } from '../types/api';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { extractApiError } from '../utils/apiError';
import { SessionGuidelines } from '../components/SessionGuidelines';

type PaymentMethod = 'saved-card' | 'apple-pay' | 'new-card';

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; subtitle?: string; icon: any }[] = [
  { id: 'saved-card', label: 'Saved Card', subtitle: 'Visa •••• 4242', icon: CreditCard },
  { id: 'apple-pay', label: 'Apple Pay', icon: Smartphone },
  { id: 'new-card', label: 'New Credit/Debit Card', icon: CreditCard },
];

function timeLabel(t: string) {
  return t?.slice(0, 5) ?? '';
}
function dateLabel(iso: string) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export interface TrainerCheckoutProps {
  slotId: string;
  sessionId: string;
  sessionTitle: string;
  trainerDisplayName: string;
  category: string;
  imageUrl: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  location: string;
  isOnline: boolean;
  price: string;
}

export default function TrainerCheckoutScreen(props: TrainerCheckoutProps) {
  const {
    slotId, sessionTitle, trainerDisplayName, category, imageUrl,
    slotDate, startTime, endTime, location, isOnline, price,
  } = props;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('saved-card');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const amount = Number(price) || 0;

  const handlePayAndJoin = async () => {
    if (!agreed) {
      Alert.alert('One More Thing', 'Please confirm you\'ve read the session guidelines before paying.');
      return;
    }
    setSubmitting(true);
    try {
      // Simulated payment — matches the convention used by JoinCheckoutScreen
      // (no real payment gateway exists in this app yet). The booking is only
      // created on the backend after this "payment" step succeeds.
      await new Promise<void>((resolve) => setTimeout(resolve, 800));
      const booking: TrainerBooking = await trainerApi.joinSlot(slotId);
      router.replace({
        pathname: '/trainer-booking-confirmed/[bookingId]',
        params: {
          bookingId: String(booking.id),
          sessionTitle: booking.sessionTitle ?? sessionTitle,
          trainerDisplayName: booking.trainerDisplayName ?? trainerDisplayName,
          slotDate: booking.slotDate ?? slotDate,
          startTime: booking.startTime ?? startTime,
          endTime: booking.endTime ?? endTime,
          location,
          isOnline: isOnline ? '1' : '0',
          pricePaid: String(booking.pricePaid ?? amount),
        },
      } as any);
    } catch (err) {
      Alert.alert('Payment Failed', extractApiError(err, 'Could not complete your booking. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex1} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft color={Colors.text} size={22} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Session summary */}
        <View style={styles.summaryCard}>
          {imageUrl ? (
            <Image source={{ uri: resolveMediaUrl(imageUrl) }} style={styles.summaryImage} />
          ) : (
            <LinearGradient colors={[Colors.trainer, Colors.primaryDark]} style={styles.summaryImage} />
          )}
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryTitle} numberOfLines={2}>{sessionTitle}</Text>
            {!!trainerDisplayName && <Text style={styles.summaryTrainer}>with {trainerDisplayName}</Text>}
            <View style={styles.summaryMetaRow}>
              <Calendar color={Colors.trainer} size={12.5} strokeWidth={2.2} />
              <Text style={styles.summaryMetaText}>{dateLabel(slotDate)}</Text>
            </View>
            <View style={styles.summaryMetaRow}>
              <Clock color={Colors.trainer} size={12.5} strokeWidth={2.2} />
              <Text style={styles.summaryMetaText}>{timeLabel(startTime)} – {timeLabel(endTime)}</Text>
            </View>
            <View style={styles.summaryMetaRow}>
              {isOnline ? <Video color={Colors.trainer} size={12.5} strokeWidth={2.2} /> : <MapPin color={Colors.trainer} size={12.5} strokeWidth={2.2} />}
              <Text style={styles.summaryMetaText} numberOfLines={1}>{isOnline ? 'Online session' : (location || 'In person')}</Text>
            </View>
          </View>
        </View>

        {/* Payment breakdown */}
        <Text style={styles.sectionTitle}>Payment Breakdown</Text>
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Session fee</Text>
            <Text style={styles.summaryValue}>LKR {amount.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Due</Text>
            <Text style={styles.totalValue}>LKR {amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment methods */}
        <Text style={styles.sectionTitle}>Payment Method</Text>
        {PAYMENT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = selectedMethod === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.paymentOption, selected && styles.paymentOptionSelected]}
              onPress={() => setSelectedMethod(option.id)}
            >
              <View style={styles.paymentIconWrap}>
                <Icon color={Colors.text} size={20} strokeWidth={2} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.paymentLabel}>{option.label}</Text>
                {option.subtitle && <Text style={styles.paymentSubtitle}>{option.subtitle}</Text>}
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          );
        })}

        {/* Session guidelines + required acknowledgment */}
        <Text style={styles.sectionTitle}>Before You Join</Text>
        <View style={styles.card}>
          <SessionGuidelines category={category as TrainerCategory} variant="full" />
        </View>

        <Pressable style={styles.agreeRow} onPress={() => setAgreed((v) => !v)} hitSlop={4}>
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Check color={Colors.white} size={13} strokeWidth={3} />}
          </View>
          <Text style={styles.agreeText}>
            I've read the session guidelines and confirm I'm fit to participate, or I'll inform the trainer of any
            health conditions or injuries beforehand.
          </Text>
        </Pressable>

        <View style={styles.secureRow}>
          <Lock color={Colors.textMuted} size={13} strokeWidth={2} />
          <Text style={styles.secureText}>SECURE SSL ENCRYPTION</Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: (Platform.OS === 'ios' ? 24 : 16) + insets.bottom }]}>
        <Pressable
          style={[styles.payButton, (!agreed || submitting) && styles.payButtonDisabled]}
          onPress={handlePayAndJoin}
          disabled={!agreed || submitting}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <>
                <ShieldCheck color={Colors.white} size={18} strokeWidth={2.2} />
                <Text style={styles.payButtonText}>Pay & Join  LKR {amount.toFixed(2)}</Text>
              </>
          }
        </Pressable>
        <Text style={styles.legalText}>
          By confirming, you agree to the Paasxo Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.background,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, backgroundColor: Colors.background },

  summaryCard: {
    flexDirection: 'row', gap: 12, backgroundColor: Colors.white, borderRadius: 16, padding: 12, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  summaryImage: { width: 72, height: 72, borderRadius: 12 },
  summaryInfo: { flex: 1, gap: 3, justifyContent: 'center' },
  summaryTitle: { fontSize: 14.5, fontWeight: '800', color: Colors.text },
  summaryTrainer: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  summaryMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryMetaText: { fontSize: 11.5, color: Colors.textSecondary, fontWeight: '600' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12, marginTop: 8 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 8 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  summaryLabel: { fontSize: 14, color: Colors.textSecondary, flex: 1, marginRight: 8 },
  summaryValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.neutral200, marginVertical: 6 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: Colors.trainer },

  paymentOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: 'transparent',
  },
  paymentOptionSelected: { borderColor: Colors.trainer },
  paymentIconWrap: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: Colors.neutral100,
    alignItems: 'center', justifyContent: 'center',
  },
  paymentLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  paymentSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.neutral300, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: Colors.trainer },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.trainer },

  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16, paddingRight: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.neutral300,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: Colors.trainer, borderColor: Colors.trainer },
  agreeText: { flex: 1, fontSize: 12.5, color: Colors.textSecondary, lineHeight: 18 },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 },
  secureText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: Colors.textMuted },

  bottomBar: {
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.neutral200,
  },
  payButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.trainer, borderRadius: 16, paddingVertical: 16,
  },
  payButtonDisabled: { opacity: 0.5 },
  payButtonText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  legalText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 16 },
});
