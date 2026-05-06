import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
  // Stripe SDK retries with exponential backoff on 429s, 5xx, and network
  // errors. 3 retries absorbs transient issues without runaway latency.
  maxNetworkRetries: 3,
  appInfo: {
    name: 'Luis y Sara Bachatango',
    version: '0.1.0',
  },
});
