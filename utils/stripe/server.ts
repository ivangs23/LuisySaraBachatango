import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
  appInfo: {
    name: 'Luis y Sara Bachatango',
    version: '0.1.0',
  },
});
