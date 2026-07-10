'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import type Stripe from 'stripe';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { isDemoMode } from '@/utils/demo/mode';
import { provisionGuestPurchase } from '@/utils/checkout/provision-guest';

export async function simulatePurchase(formData: FormData): Promise<void> {
  // Defensa en profundidad: jamás provisiona fuera de modo demo.
  if (!isDemoMode()) {
    redirect('/');
  }

  const courseId = ((formData.get('courseId') as string | null) ?? '').trim();
  const formEmail = ((formData.get('email') as string | null) ?? '').trim().toLowerCase();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = (user?.email ?? formEmail).toLowerCase();

  if (!courseId || !email) {
    redirect(`/demo-checkout?courseId=${encodeURIComponent(courseId)}&error=missing`);
  }

  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: course } = await admin
    .from('courses')
    .select('price_eur')
    .eq('id', courseId)
    .eq('is_published', true)
    .single();

  if (!course) {
    redirect(`/demo-checkout?courseId=${encodeURIComponent(courseId)}&error=course-not-found`);
  }

  const amount = course.price_eur ? Math.round(course.price_eur * 100) : 0;

  const session = {
    id: `demo_${randomUUID()}`,
    customer_details: { email },
    metadata: { courseId },
    amount_total: amount,
    customer: null,
  } as unknown as Stripe.Checkout.Session;

  await provisionGuestPurchase(session, admin);

  redirect(`/gracias?demo=1&email=${encodeURIComponent(email)}`);
}
