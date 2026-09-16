// Subscription product identifiers - MUST match exactly what's configured in
// App Store Connect (Monetization > Subscriptions) and Google Play Console
// (Monetize > Subscriptions) for this to work. These are placeholders until
// those products exist - react-native-iap will simply fail to find the
// product (a clear, catchable error) until then, it won't crash.
//
// Convention: one product id shared across platforms where possible keeps
// SubscriptionVerificationService's cross-check between requested/verified
// productId simple - if Apple and Google end up needing different ids for
// some reason, branch this by Platform.OS instead.
export const PAASXO_PRO_MONTHLY_PRODUCT_ID = 'paasxo_pro_monthly';
