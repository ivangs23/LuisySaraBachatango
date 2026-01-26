import { headers } from 'next/headers';
import { stripe } from '@/utils/stripe/server';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

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
  } catch (error: any) {
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  const supabase = await createClient();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscriptionId = session.subscription as string;
    const userId = session.metadata?.userId;

    if (userId) {
      if (subscriptionId) {
        // Update subscription in Supabase
        const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = subscriptionResponse as any;
        
        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            id: subscriptionId,
            user_id: userId,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          });
  
        if (error) {
          console.error('Error updating subscription:', error);
          return new NextResponse('Database Error', { status: 500 });
        }
      } else {
        // Handle one-time payment (Lifetime access)
        // We'll Create a "fake" subscription record with long expiry
        // Use session.id as ID since we don't have sub ID
        
        // Check payment status
        if (session.payment_status === 'paid') {
           const { error } = await supabase
            .from('subscriptions')
            .upsert({
              id: session.id, // Use session ID as PK
              user_id: userId,
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(new Date().setFullYear(new Date().getFullYear() + 100)).toISOString(), // 100 years
            });

           if (error) {
             console.error('Error updating one-time subscription:', error);
             return new NextResponse('Database Error', { status: 500 });
           }
        }
      }
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = event.data.object as any; // Cast to any to avoid type errors with current_period_start
    
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      })
      .eq('id', subscription.id);
      
     if (error) {
        console.error('Error updating subscription:', error);
        return new NextResponse('Database Error', { status: 500 });
      }
  }

  return new NextResponse(null, { status: 200 });
}
