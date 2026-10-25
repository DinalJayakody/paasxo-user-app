import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, CreditCard, Hourglass, Lock, MessageSquareText, Salad, ShieldCheck, UserRound } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../styles/colors';
import { trainerApi } from '../api/trainerApi';
import { paymentApi } from '../api/paymentApi';
import { CheckoutInitiationResponse, TrainerPlan, TrainerPlanPurchase } from '../types/api';
import { extractApiError } from '../utils/apiError';
import { goBack } from '../utils/navigation';
import { PayHereCheckoutWebView } from '../components/PayHereCheckoutWebView';

const MAX_CLIENT_NOTE = 1000; // mirrors TrainerPlanService.MAX_CLIENT_NOTE
const POLL_ATTEMPTS = 10;
const POLL_MS = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const PLAN_TYPE_LABEL: Record<string, string> = {
  WORKOUT: 'Workout plan', DIET: 'Diet plan', MEMBERSHIP: 'Membership',
};

export function planPriceLabel(p: Pick<TrainerPlan, 'price' | 'type' | 'billingPeriod' | 'durationWeeks'>) {
  const price = p.price && p.price > 0 ? `LKR ${Number(p.price).toLocaleString()}` : 'Free';
  if (p.type === 'MEMBERSHIP') return `${price} / ${p.billingPeriod === 'ANNUAL' ? 'year' : 'month'}`;
  return `${price} · ${p.durationWeeks ?? 0} week${p.durationWeeks === 1 ? '' : 's'}`;
}

function PlanIcon({ type, color, size = 22 }: { type: string; color: string; size?: number }) {
  if (type === 'DIET') return <Salad color={color} size={size} />;
  if (type === 'MEMBERSHIP') return <CreditCard color={color} size={size} />;
  return <ClipboardList color={color} size={size} />;
}
export { PlanIcon };

/** A trainer's workout/diet plan or membership: details, buy, and — once bought — the plan itself. */
export default function TrainerPlanScreen({ planId }: { planId: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<TrainerPlan | null>(null);
  const [purchase, setPurchase] = useState<TrainerPlanPurchase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [checkout, setCheckout] = useState<CheckoutInitiationResponse | null>(null);
  const [webOpen, setWebOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null); // non-null while editing
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const p = await trainerApi.getPlan(planId);
      setPlan(p);
      if (p.purchased) {
        const mine = await trainerApi.getMyPlanPurchases().catch(() => []);
        setPurchase(mine.find((x) => String(x.planId) === String(p.id) && x.status === 'ACTIVE') ?? null);
      } else {
        setPurchase(null);
      }
    } catch (e) {
      setError(extractApiError(e, 'Could not load this plan.'));
    }
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  const confirmPaid = async (id: number) => {
    setWebOpen(false);
    setBusy(true);
    try {
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        const st = await paymentApi.getStatus('TRAINER_PLAN', id);
        if (st.status === 'CHARGED' || st.status === 'CONFIRMED') {
          await sleep(600); // the purchase row lands with the webhook
          await load();
          Alert.alert('You\'re in!', plan?.type === 'MEMBERSHIP'
            ? 'Your membership is active. Join this trainer\'s sessions without paying per session.'
            : 'Your plan is unlocked below.');
          return;
        }
        if (st.status === 'FAILED' || st.status === 'EXPIRED') {
          Alert.alert('Payment failed', 'Your payment could not be confirmed. Please try again.');
          return;
        }
        await sleep(POLL_MS);
      }
      Alert.alert('Still processing', 'We\'re still confirming your payment. It will appear under My plans shortly.');
    } catch (e) {
      Alert.alert('Payment failed', extractApiError(e, 'Could not confirm your payment.'));
    } finally {
      setBusy(false);
    }
  };

  const buy = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const res = await trainerApi.orderPlan(plan.id);
      if (res.purchased) { await load(); return; }
      if (res.paymentOrderId == null) throw new Error('Payment could not be started — please try again.');
      setOrderId(res.paymentOrderId);
      const init = await paymentApi.initiateCheckout('TRAINER_PLAN', res.paymentOrderId);
      if (init.dummyMode) { await confirmPaid(res.paymentOrderId); return; }
      setCheckout(init);
      setWebOpen(true);
    } catch (e) {
      Alert.alert('Could not start purchase', extractApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (!plan?.myPurchaseId || noteDraft == null) return;
    setSavingNote(true);
    try {
      const res = await trainerApi.updatePlanClientNote(plan.myPurchaseId, noteDraft.trim());
      setPlan({ ...plan, clientNote: res.clientNote ?? null });
      setNoteDraft(null);
    } catch (e) {
      Alert.alert('Could not save', extractApiError(e));
    } finally {
      setSavingNote(false);
    }
  };

  const cancel = () => {
    if (!purchase) return;
    const paid = purchase.pricePaid > 0;
    Alert.alert(
      paid ? 'Cancel and get a refund?' : 'Remove this plan?',
      paid ? 'You\'ll lose access and get a full refund to your card.' : 'You\'ll lose access to it.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: paid ? 'Cancel & refund' : 'Remove', style: 'destructive', onPress: async () => {
            setBusy(true);
            try { await trainerApi.cancelPlanPurchase(purchase.id); await load(); }
            catch (e) { Alert.alert('Could not cancel', extractApiError(e)); }
            finally { setBusy(false); }
          },
        },
      ],
    );
  };

  if (!plan) {
    return (
      <SafeAreaView style={[s.root, s.center]}>
        {error ? (
          <>
            <Text style={s.muted}>{error}</Text>
            <Pressable onPress={() => goBack(router)} style={{ marginTop: 14 }}><Text style={s.link}>Go back</Text></Pressable>
          </>
        ) : <ActivityIndicator color={colors.trainer} />}
      </SafeAreaView>
    );
  }

  const owned = !!plan.purchased;
  const programme = plan.type !== 'MEMBERSHIP';
  const personal = plan.personalContent?.trim() ? plan.personalContent : null;
  const tailored = programme && (!!plan.personalised || !!personal || !!purchase?.assignedByTrainer);
  const trainerName = plan.trainerDisplayName ?? 'Your trainer';
  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const until = plan.accessUntil ? new Date(plan.accessUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}>
        <LinearGradient colors={[colors.trainer, colors.primaryDark]} style={[s.hero, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => goBack(router)} style={s.back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft color="#fff" size={20} strokeWidth={2.5} />
          </Pressable>
          <View style={s.heroIcon}><PlanIcon type={plan.type} color="#fff" size={26} /></View>
          <Text style={s.kicker}>{(PLAN_TYPE_LABEL[plan.type] ?? 'Plan').toUpperCase()}</Text>
          <Text style={s.title}>{plan.title}</Text>
          {!!plan.trainerDisplayName && <Text style={s.by}>by {plan.trainerDisplayName}</Text>}
          <Text style={s.price}>{purchase?.assignedByTrainer ? `Given to you by ${trainerName}` : planPriceLabel(plan)}</Text>
          {tailored && (
            <View style={s.tailorPill}>
              <UserRound color="#fff" size={13} />
              <Text style={s.tailorText}>Tailored to you</Text>
            </View>
          )}
        </LinearGradient>

        <View style={s.body}>
          {owned && (
            <View style={s.ownedCard}>
              <CheckCircle2 color={colors.success} size={20} />
              <View style={{ flex: 1 }}>
                <Text style={s.ownedTitle}>{plan.type === 'MEMBERSHIP' ? 'Membership active' : 'You own this plan'}</Text>
                {!!until && <Text style={s.ownedSub}>Access until {until}</Text>}
              </View>
            </View>
          )}

          {!!plan.summary && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>About</Text>
              <Text style={s.text}>{plan.summary}</Text>
            </View>
          )}

          {plan.type === 'MEMBERSHIP' && (
            <View style={s.perk}>
              <CalendarClock color={colors.trainer} size={18} />
              <Text style={s.perkText}>
                Members join {plan.trainerDisplayName ?? 'this trainer'}'s sessions at no extra cost while the membership is active.
              </Text>
            </View>
          )}

          {owned && tailored && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Your personal plan</Text>
              {personal ? (
                <>
                  <Text selectable style={[s.content, s.personal]}>{personal}</Text>
                  {!!plan.personalUpdatedAt && (
                    <Text style={s.updated}>Written for you by {trainerName} · updated {fmtDate(plan.personalUpdatedAt)}</Text>
                  )}
                </>
              ) : (
                <View style={s.waiting}>
                  <Hourglass color={colors.trainer} size={18} />
                  <Text style={s.waitingText}>
                    {trainerName} is preparing your plan. Tell them your goals below — you'll get a notification when it's ready.
                  </Text>
                </View>
              )}
            </View>
          )}

          {owned && tailored && plan.myPurchaseId != null && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>For your trainer</Text>
              {noteDraft == null ? (
                <Pressable onPress={() => setNoteDraft(plan.clientNote ?? '')} style={s.noteCard} accessibilityRole="button">
                  <MessageSquareText color={colors.trainer} size={18} />
                  <Text style={[s.noteText, !plan.clientNote && { color: colors.textSecondary }]}>
                    {plan.clientNote || 'Add your goals, allergies, injuries or food preferences'}
                  </Text>
                  <Text style={s.link}>{plan.clientNote ? 'Edit' : 'Add'}</Text>
                </Pressable>
              ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'position' : undefined}>
                  <TextInput
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    placeholder="e.g. Goal: lose 5 kg by March. Vegetarian, allergic to peanuts. Knee injury — no jumping."
                    placeholderTextColor={colors.textMuted}
                    style={s.noteInput}
                    multiline
                    maxLength={MAX_CLIENT_NOTE}
                    autoFocus
                  />
                  <View style={s.noteActions}>
                    <Text style={s.counter}>{noteDraft.length}/{MAX_CLIENT_NOTE}</Text>
                    <Pressable onPress={() => setNoteDraft(null)} disabled={savingNote} hitSlop={8}>
                      <Text style={[s.link, { color: colors.textSecondary }]}>Cancel</Text>
                    </Pressable>
                    <Pressable onPress={saveNote} disabled={savingNote} hitSlop={8}>
                      {savingNote ? <ActivityIndicator color={colors.trainer} /> : <Text style={s.link}>Save</Text>}
                    </Pressable>
                  </View>
                  <Text style={s.updated}>Only {trainerName} can see this.</Text>
                </KeyboardAvoidingView>
              )}
            </View>
          )}

          {(!owned || !tailored || !!plan.content) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {plan.type === 'MEMBERSHIP' ? 'What you get' : owned && tailored ? 'General guidance' : 'The plan'}
            </Text>
            {owned ? (
              plan.content
                ? <Text selectable style={s.content}>{plan.content}</Text>
                : <Text style={s.muted}>The trainer hasn't added details yet — check back soon.</Text>
            ) : tailored ? (
              <View style={s.locked}>
                <UserRound color={colors.textMuted} size={18} />
                <Text style={[s.muted, { flex: 1, textAlign: 'left' }]}>
                  After you {plan.price && plan.price > 0 ? 'buy' : 'add'} it, tell {trainerName} your goals and they'll write a plan just for you.
                </Text>
              </View>
            ) : (
              <View style={s.locked}>
                <Lock color={colors.textMuted} size={18} />
                <Text style={s.muted}>Unlocks after you {plan.price && plan.price > 0 ? 'buy' : 'add'} this plan.</Text>
              </View>
            )}
          </View>
          )}

          {owned && purchase && (purchase.refundable || purchase.pricePaid === 0) && (
            <Pressable onPress={cancel} disabled={busy} style={s.cancelBtn} accessibilityRole="button">
              <Text style={s.cancelText}>{purchase.pricePaid > 0 ? 'Cancel for a full refund (within 24h)' : 'Remove this plan'}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {!owned && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={buy} disabled={busy || !plan.active} accessibilityRole="button"
            style={({ pressed }) => [s.buyBtn, (pressed || busy || !plan.active) && { opacity: 0.85 }]}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <ShieldCheck color="#fff" size={18} />
                <Text style={s.buyText}>
                  {!plan.active ? 'No longer available'
                    : plan.price && plan.price > 0
                    ? `${plan.type === 'MEMBERSHIP' ? 'Join' : 'Buy'} · LKR ${Number(plan.price).toLocaleString()}`
                    : 'Add for free'}
                </Text>
              </>
            )}
          </Pressable>
          {!!plan.price && plan.price > 0 && (
            <Text style={s.legal}>Paid securely via PayHere. Cancel within 24 hours for a full refund.</Text>
          )}
        </View>
      )}

      <PayHereCheckoutWebView
        visible={webOpen}
        checkout={checkout}
        onCompleted={() => orderId != null && confirmPaid(orderId)}
        onDismissed={() => setWebOpen(false)}
        onError={(m) => { setWebOpen(false); Alert.alert('Payment failed', m || 'Something went wrong during payment.'); }}
        onClose={() => setWebOpen(false)}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  hero: { paddingHorizontal: 20, paddingBottom: 24 },
  back: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  heroIcon: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  kicker: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 4 },
  by: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', marginTop: 4 },
  price: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 12 },
  body: { padding: 20 },
  ownedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16,
    backgroundColor: colors.success + '18', borderWidth: 1, borderColor: colors.success + '40', marginBottom: 6,
  },
  ownedTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  ownedSub: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 8 },
  text: { fontSize: 14.5, lineHeight: 21, color: colors.textSecondary },
  content: {
    fontSize: 14.5, lineHeight: 22, color: colors.text, padding: 16, borderRadius: 16,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.divider,
  },
  perk: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, padding: 14, borderRadius: 14,
    backgroundColor: colors.trainer + '14',
  },
  perkText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: colors.text, fontWeight: '600' },
  locked: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 16,
    backgroundColor: colors.inputBg,
  },
  muted: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  link: { color: colors.trainer, fontWeight: '800' },
  cancelBtn: { marginTop: 24, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { color: colors.error, fontWeight: '700', fontSize: 14 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: colors.cardBg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider,
  },
  buyBtn: {
    height: 54, borderRadius: 16, backgroundColor: colors.trainer, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  buyText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  legal: { textAlign: 'center', fontSize: 11.5, color: colors.textMuted, marginTop: 8 },
  tailorPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tailorText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  personal: { borderColor: colors.trainer + '55', backgroundColor: colors.trainer + '0D' },
  updated: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  waiting: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14,
    backgroundColor: colors.trainer + '14',
  },
  waitingText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: colors.text, fontWeight: '600' },
  noteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14,
    backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.divider,
  },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  noteInput: {
    minHeight: 110, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.trainer + '66',
    backgroundColor: colors.cardBg, color: colors.text, fontSize: 14.5, textAlignVertical: 'top',
  },
  noteActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 18, marginTop: 10 },
  counter: { flex: 1, fontSize: 12, color: colors.textMuted },
});
