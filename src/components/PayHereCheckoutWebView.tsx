import React, { useMemo } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '../styles/colors';
import { CheckoutInitiationResponse } from '../types/api';

type PayHereMessage =
  | { type: 'completed'; orderId: string }
  | { type: 'dismissed' }
  | { type: 'error'; error: string };

interface PayHereCheckoutWebViewProps {
  visible: boolean;
  checkout: CheckoutInitiationResponse | null;
  onCompleted: () => void;
  onDismissed: () => void;
  onError: (message: string) => void;
  onClose: () => void;
}

/**
 * Hosts PayHere's checkout UI via their JS SDK, served by our own backend at
 * checkout.checkoutPageUrl (see PayHereCheckoutPageController) and loaded
 * here as a real URL — not built as inline HTML. PayHere's JS SDK checks the
 * calling page's origin against the domain/app the Merchant Secret was
 * issued for, and a WebView loading raw HTML has no real origin to check
 * against, so the page has to be served from the tunnel/domain instead.
 * Card details are entered on PayHere's own UI, never seen by this app.
 *
 * IMPORTANT: onCompleted here only means "the checkout UI finished" — it is
 * NOT proof the charge succeeded. Only the signed server-to-server webhook
 * PayHere sends to the backend can confirm that (see PayHereWebhookController).
 * The caller must poll payment status after onCompleted, not trust it directly.
 */
export function PayHereCheckoutWebView({
  visible,
  checkout,
  onCompleted,
  onDismissed,
  onError,
  onClose,
}: PayHereCheckoutWebViewProps) {
  const handleMessage = (event: WebViewMessageEvent) => {
    let msg: PayHereMessage;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'completed') onCompleted();
    else if (msg.type === 'dismissed') onDismissed();
    else if (msg.type === 'error') onError(msg.error);
  };

  // WebView treats a new `source` object identity as a fresh navigation command, not
  // just a re-render — and `{{ uri: ... }}` inline below would otherwise create a brand
  // new object on every render of this component. Once PayHere's own startPayment()
  // has navigated the WebView away to sandbox.payhere.lk for card entry, any unrelated
  // parent re-render (e.g. the keyboard opening, which several of the safe-area-insets
  // hooks used by the checkout screens react to) would hand WebView a new-but-equal
  // source object and it would snap straight back to our own checkout-page URL —
  // discarding PayHere's in-progress card-entry session and looking exactly like the
  // app "rebooting" back to the initial checkout screen. Memoizing on the URL string
  // itself keeps the same object across re-renders unless the URL actually changes.
  const source = useMemo(
    () => (checkout?.checkoutPageUrl ? { uri: checkout.checkoutPageUrl } : undefined),
    [checkout?.checkoutPageUrl]
  );

  if (!visible) return null;

  return (
    // A full-screen absolutely-positioned View, not React Native's <Modal> — Modal
    // presents in its own native window/view controller, and on iOS that has a known
    // crash interaction with a WebView inside it once the keyboard opens for text
    // input (exactly what happens the moment the user starts typing card details on
    // PayHere's hosted form). Same full-screen look, but staying in the app's normal
    // view hierarchy sidesteps that keyboard/window handoff entirely.
    <View style={styles.overlay}>
      <SafeAreaView style={styles.flex1}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <ArrowLeft color={Colors.text} size={22} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.headerTitle}>Secure Payment</Text>
          <View style={{ width: 22 }} />
        </View>
        {!!source && (
          <WebView
            source={source}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    zIndex: 1000,
    elevation: 1000,
  },
  flex1: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.background,
    borderBottomWidth: 1, borderBottomColor: Colors.neutral200,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
});
