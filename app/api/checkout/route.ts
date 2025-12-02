import { createClient } from '@/utils/supabase/server';
import { stripe } from '@/utils/stripe/server';
import { STRIPE_CONFIG } from '@/utils/stripe/config';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { priceId } = await req.json();
  const price = priceId || STRIPE_CONFIG.SUBSCRIPTION_PRICE_ID;

  // Check if user already has a Stripe Customer ID in Supabase
  // For now, we'll create a new customer or let Stripe handle it via email if we were syncing
  // Ideally, we store stripe_customer_id in the profiles table.
  
  // Let's fetch the profile to see if we have a customer ID (schema needs update if we want to store it)
  // For this MVP, we will rely on email matching or create a new customer each time (not ideal but works for v0)
  // Better: Create customer if not exists.

  let customerId;
  // Fetch profile (assuming we added stripe_customer_id to profiles, which we haven't yet in the SQL I wrote)
  // Let's just create a session with customer_email for now.

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      customer_email: user.email,
      line_items: [
        {
          price: price,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/profile`,
      metadata: {
        userId: user.id,
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (err: any) {
    console.error(err);
    return new NextResponse(err.message, { status: 500 });
  }
}
