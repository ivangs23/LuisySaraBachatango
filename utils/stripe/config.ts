export const STRIPE_CONFIG = {
  CURRENCY: 'eur',

  // Subscription price IDs (recurring) — replace with real IDs from Stripe Dashboard when enabling
  SUBSCRIPTION_PRICES: {
    '1month':  'price_1S64042941927200613515',
    '6months': 'price_1S64042941927200613515',
    '1year':   'price_1S64042941927200613515',
  } as Record<string, string>,
};
