import { headers } from 'next/headers';
import { stripe } from '@/utils/stripe/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('Stripe-Signature') as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const courseId = session.metadata?.courseId;

    if (!userId) {
      console.error('Webhook: missing userId in metadata');
      return new NextResponse('Missing userId', { status: 400 });
    }

    // Persist stripe_customer_id in profile if not already set
    if (session.customer) {
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: session.customer as string })
        .eq('id', userId)
        .is('stripe_customer_id', null);
    }

    if (courseId) {
      // One-time course purchase — idempotent on stripe_session_id (UNIQUE).
      // No pre-check needed: concurrent Stripe retries collapse via ON CONFLICT.
      if (session.payment_status === 'paid') {
        const { error } = await supabase
          .from('course_purchases')
          .upsert(
            {
              user_id: userId,
              course_id: courseId,
              stripe_session_id: session.id,
              amount_paid: session.amount_total ?? null,
            },
            { onConflict: 'stripe_session_id', ignoreDuplicates: true }
          );

        if (error) {
          console.error('Error saving course purchase:', error);
          return new NextResponse('Database Error', { status: 500 });
        }
      }
    } else {
      // Subscription purchase — upsert on subscription ID is already idempotent
      const subscriptionId = session.subscription as string | null;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        const item = subscription.items.data[0]
        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            id: subscriptionId,
            user_id: userId,
            status: subscription.status,
            plan_type: item?.price.id ?? null,
            current_period_start: new Date((item?.current_period_start ?? 0) * 1000).toISOString(),
            current_period_end: new Date((item?.current_period_end ?? 0) * 1000).toISOString(),
          });

        if (error) {
          console.error('Error saving subscription:', error);
          return new NextResponse('Database Error', { status: 500 });
        }
      }
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;

    const item = subscription.items.data[0]
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date((item?.current_period_start ?? 0) * 1000).toISOString(),
        current_period_end: new Date((item?.current_period_end ?? 0) * 1000).toISOString(),
      })
      .eq('id', subscription.id);

    if (error) {
      console.error('Error updating subscription:', error);
      return new NextResponse('Database Error', { status: 500 });
    }
  }

  return new NextResponse(null, { status: 200 });
}
