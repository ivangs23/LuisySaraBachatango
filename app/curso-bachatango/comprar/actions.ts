'use server';

import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type Stripe from 'stripe';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { stripe } from '@/utils/stripe/server';
import { STRIPE_CONFIG } from '@/utils/stripe/config';
import { isTestPurchaseMode, readTestCookie } from '@/utils/demo/test-mode';
import { canProvisionInline } from '@/utils/checkout/demo-provision-guard';
import { provisionFromPending } from '@/utils/checkout/provision-registration';
import { validateRegistration } from '@/utils/checkout/registration-validation';
import { hashPassword } from '@/utils/checkout/password-hash';
import { rateLimit, rateLimitKey } from '@/utils/rate-limit';
import { getClientIp } from '@/utils/auth/client-ip';

export async function landingCheckout(formData: FormData): Promise<void> {
  const ip = getClientIp(await headers());
  const courseId = ((formData.get('courseId') as string | null) ?? '').trim();
  // Safe fields re-echoed after a validation error (never the password).
  const rawName = ((formData.get('fullName') as string | null) ?? '').trim();
  const rawEmail = ((formData.get('email') as string | null) ?? '').trim();
  const back = (code: string) =>
    `/curso-bachatango/comprar?courseId=${encodeURIComponent(courseId)}&error=${code}` +
    `&name=${encodeURIComponent(rawName)}&email=${encodeURIComponent(rawEmail)}`;

  // Rate limit against abuse of the unauthenticated pending INSERT (accumulates
  // PII + bcrypt hashes): per-IP burst, per-email/day, AND a per-IP/day row cap
  // so one IP cycling many distinct emails is still bounded.
  const rlIp = await rateLimit(rateLimitKey([ip, 'landing-checkout']), 10, 60_000);
  if (!rlIp.ok) redirect(back('rate'));
  const emailForKey = rawEmail.toLowerCase();
  const rlEmail = await rateLimit(rateLimitKey([emailForKey || ip, 'landing-checkout-email']), 5, 24 * 60 * 60_000);
  if (!rlEmail.ok) redirect(back('rate'));
  const rlIpDay = await rateLimit(rateLimitKey([ip, 'landing-checkout-ip-day']), 30, 24 * 60 * 60_000);
  if (!rlIpDay.ok) redirect(back('rate'));

  // Validate ALL fields BEFORE any hashing or DB write.
  const v = validateRegistration({
    fullName: formData.get('fullName'), email: formData.get('email'),
    password: formData.get('password'), repeatPassword: formData.get('repeatPassword'),
    country: formData.get('country'), city: formData.get('city'),
    postalCode: formData.get('postalCode'),
    dateOfBirth: formData.get('dateOfBirth'), danceLevel: formData.get('danceLevel'),
    phone: formData.get('phone'), marketingConsent: formData.get('marketingConsent'),
    acceptTerms: formData.get('acceptTerms'),
  });
  if (!courseId) redirect(back('missing'));
  if (!v.ok) redirect(back(v.code));
  const reg = v.data;

  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: course } = await admin
    .from('courses').select('title, price_eur').eq('id', courseId).eq('is_published', true).single();
  if (!course || !course.price_eur || course.price_eur <= 0 || course.price_eur > 10000) {
    redirect(back('course'));
  }
  const amountExpected = Math.round(course.price_eur * 100);

  // Hash the password into a local const; the plaintext is dropped immediately
  // after and NEVER logged, echoed, or sent to Stripe.
  const passwordHash = await hashPassword(reg.password);

  // Dedupe: drop any prior un-consumed pending row for this email so abandoned
  // attempts don't accumulate PII + hashes.
  await admin.from('pending_registrations').delete().eq('email', reg.email);

  // Insert the pending row; its id is the opaque pendingId.
  const { data: pending, error: pendingErr } = await admin
    .from('pending_registrations')
    .insert({
      id: randomUUID(),
      email: reg.email, full_name: reg.fullName, password_hash: passwordHash,
      country: reg.country, city: reg.city, postal_code: reg.postalCode, date_of_birth: reg.dateOfBirth,
      phone: reg.phone, marketing_consent: reg.marketingConsent, dance_level: reg.danceLevel,
      course_id: courseId, amount_expected: amountExpected,
    })
    .select('id')
    .single();
  if (pendingErr || !pending) redirect(back('account_creation_failed'));
  const pendingId = pending.id as string;

  // Demo/test: provision inline (simulate the webhook) behind the prod guard.
  // On ANY handled failure or guard refusal, delete the pending row (it holds
  // the password_hash + PII) — never leave it for the 30-day cron.
  if (await isTestPurchaseMode()) {
    const triggeredByAdminCookie = await readTestCookie();
    if (!canProvisionInline({ triggeredByAdminCookie, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL })) {
      await admin.from('pending_registrations').delete().eq('id', pendingId);
      redirect(back('account_creation_failed'));
    }
    const synthetic = {
      id: `demo_${randomUUID()}`,
      client_reference_id: pendingId,
      payment_status: 'paid',
      amount_total: amountExpected,
      customer: null,
      metadata: { courseId, source: 'landing', pendingId },
    } as unknown as Stripe.Checkout.Session;
    let provisioned = false;
    try {
      const r = await provisionFromPending(synthetic, admin, { isDemo: true });
      provisioned = r.ok;
    } catch {
      provisioned = false;
    }
    if (!provisioned) {
      await admin.from('pending_registrations').delete().eq('id', pendingId);
      redirect(back('account_creation_failed'));
    }
    redirect(`/gracias?demo=1&email=${encodeURIComponent(reg.email)}`);
  }

  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  let url: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      customer_creation: 'always',
      customer_email: reg.email,
      client_reference_id: pendingId,
      line_items: [{
        price_data: { currency: STRIPE_CONFIG.CURRENCY, unit_amount: amountExpected, product_data: { name: course.title } },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${origin}/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/curso-bachatango`,
      metadata: { courseId, source: 'landing', pendingId },
      allow_promotion_codes: true,
    });
    url = session.url;
  } catch (e) {
    console.error('[landingCheckout] stripe', e);
  }
  if (!url) redirect(back('stripe'));
  redirect(url);
}
