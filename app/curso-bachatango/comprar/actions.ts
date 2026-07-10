'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import type Stripe from 'stripe';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { stripe } from '@/utils/stripe/server';
import { STRIPE_CONFIG } from '@/utils/stripe/config';
import { isDemoMode } from '@/utils/demo/mode';
import { provisionGuestPurchase } from '@/utils/checkout/provision-guest';

export async function landingCheckout(formData: FormData): Promise<void> {
  const courseId = ((formData.get('courseId') as string | null) ?? '').trim();
  const fullName = ((formData.get('fullName') as string | null) ?? '').trim();
  const email = ((formData.get('email') as string | null) ?? '').trim().toLowerCase();

  if (!courseId || !email || !fullName) {
    redirect(`/curso-bachatango/comprar?courseId=${encodeURIComponent(courseId)}&error=missing`);
  }

  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: course } = await admin
    .from('courses').select('title, price_eur').eq('id', courseId).eq('is_published', true).single();
  if (!course || !course.price_eur || course.price_eur <= 0 || course.price_eur > 10000) {
    redirect(`/curso-bachatango/comprar?courseId=${encodeURIComponent(courseId)}&error=course`);
  }

  const amount = Math.round(course.price_eur * 100);
  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  if (isDemoMode()) {
    const session = {
      id: `demo_${randomUUID()}`,
      customer_details: { email },
      metadata: { courseId, source: 'landing', fullName },
      amount_total: amount,
      customer: null,
    } as unknown as Stripe.Checkout.Session;
    await provisionGuestPurchase(session, admin, { isDemo: true, source: 'landing', fullName });
    redirect(`/gracias?demo=1&email=${encodeURIComponent(email)}`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    billing_address_collection: 'auto',
    customer_creation: 'always',
    customer_email: email,
    line_items: [{
      price_data: {
        currency: STRIPE_CONFIG.CURRENCY,
        unit_amount: amount,
        product_data: { name: course.title },
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${origin}/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/curso-bachatango`,
    metadata: { courseId, guest: '1', source: 'landing', fullName },
  });

  redirect(session.url!);
}
