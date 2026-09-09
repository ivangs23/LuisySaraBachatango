'use server';

import { randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type Stripe from 'stripe';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { stripe } from '@/utils/stripe/server';
import { STRIPE_CONFIG } from '@/utils/stripe/config';
import { isTestPurchaseMode, readTestCookie } from '@/utils/demo/test-mode';
import { canProvisionInline } from '@/utils/checkout/demo-provision-guard';
import { provisionFromPending } from '@/utils/checkout/provision-registration';
import { validateRegistration } from '@/utils/checkout/registration-validation';
import { rateLimit, rateLimitKey } from '@/utils/rate-limit';
import { getClientIp } from '@/utils/auth/client-ip';
import { CURRENT_TERMS_VERSION } from '@/utils/legal/terms-version';
import { alertaCritica } from '@/utils/alerta';
import { dailyVisitorHash } from '@/utils/analytics/visitor-hash';
import { isDemoMode } from '@/utils/demo/mode';

export async function landingCheckout(formData: FormData): Promise<void> {
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  const courseId = ((formData.get('courseId') as string | null) ?? '').trim();
  // Safe fields re-echoed after a validation error (never the password) so a
  // single typo doesn't wipe the whole 11-field form.
  const rawName = ((formData.get('fullName') as string | null) ?? '').trim();
  const rawEmail = ((formData.get('email') as string | null) ?? '').trim();
  // Re-echo de campos tras un error de validación vía cookie flash efímera —
  // NUNCA por query string: un redirect 303 convierte la URL en GET y el email
  // acabaría en logs de Vercel, historial e intermediarios (AUDITORIA-2026-07
  // M6). La contraseña jamás se re-echoa por ningún canal.
  const back = async (code: string) => {
    (await cookies()).set('landing_form', JSON.stringify({
      name: rawName, email: rawEmail,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/curso-bachatango',
      maxAge: 120, // autoexpira; la página no puede borrarla (server component)
    });
    const q = new URLSearchParams({ courseId, error: code });
    return `/curso-bachatango/comprar?${q.toString()}`;
  };

  // Validate ALL fields BEFORE spending any rate-limit budget or touching the DB.
  const v = validateRegistration({
    fullName: formData.get('fullName'), email: formData.get('email'),
    isAdult: formData.get('isAdult'), marketingConsent: formData.get('marketingConsent'),
    acceptTerms: formData.get('acceptTerms'),
    acceptDigitalExecution: formData.get('acceptDigitalExecution'),
  });
  if (!courseId) redirect(await back('missing'));
  if (!v.ok) redirect(await back(v.code));
  const reg = v.data;

  // Los límites van DESPUÉS de validar. Al revés, una errata en el correo
  // consumía cupo: 5 por (IP,email) al día, y al sexto intento un bloqueo de 24
  // horas cuyo mensaje decía "Espera un momento". Quien más se equivoca al
  // teclear es justo quien más quiere comprar.
  // Rate limit against abuse of the unauthenticated pending INSERT (accumulates
  // PII): per-IP burst, per-email/day, AND a per-IP/day row cap so one IP
  // cycling many distinct emails is still bounded.
  const rlIp = await rateLimit(rateLimitKey([ip, 'landing-checkout']), 10, 60_000);
  if (!rlIp.ok) redirect(await back('rate'));
  // Per-email limit scoped BY IP: the email is unauthenticated, so keying it
  // globally would let an attacker burn a specific victim's daily budget
  // (registration lockout). Scoping to (ip,email) caps repeats without
  // cross-user harm.
  const emailForKey = reg.email.toLowerCase();
  const rlEmail = await rateLimit(rateLimitKey([ip, emailForKey, 'landing-checkout-email']), 5, 24 * 60 * 60_000);
  if (!rlEmail.ok) redirect(await back('rate'));
  const rlIpDay = await rateLimit(rateLimitKey([ip, 'landing-checkout-ip-day']), 30, 24 * 60 * 60_000);
  if (!rlIpDay.ok) redirect(await back('rate'));

  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: course, error: courseErr } = await admin
    .from('courses').select('title, price_eur').eq('id', courseId).eq('is_published', true).single();
  if (!course || !course.price_eur || course.price_eur <= 0 || course.price_eur > 10000) {
    // Un curso despublicado por error, un precio a 0 o un fallo de la consulta
    // dejan la página de venta cobrando a nadie. Se distingue el fallo real de
    // la ausencia legítima para no alertar cuando el enlace trae un id inventado.
    if (courseErr) {
      alertaCritica('Checkout de la landing: no se pudo leer el curso, nadie puede comprar', {
        courseId, codigo: courseErr.code, mensaje: courseErr.message,
      });
    }
    redirect(await back('course'));
  }
  const amountExpected = Math.round(course.price_eur * 100);

  // NOTE: we intentionally do NOT dedupe prior pending rows by email here. The
  // email is unauthenticated, so a delete-by-email would let an attacker wipe a
  // victim's in-flight pending row (submitted between their form post and their
  // Stripe payment) and orphan their paid session. Each submit gets its own UUID
  // row consumed by pendingId; abandoned rows are reaped by the per-IP/day cap
  // above and the scheduled purge cron.

  // Insert the pending row; its id is the opaque pendingId.
  const { data: pending, error: pendingErr } = await admin
    .from('pending_registrations')
    .insert({
      id: randomUUID(),
      email: reg.email,
      full_name: reg.fullName,
      // Ya no se pide contraseña en el alta: la cuenta se aprovisiona sin
      // contraseña y el usuario la fija más tarde vía invitación (ver
      // provision-registration.ts). password_hash es nullable desde la
      // migración de la tarea 1.
      password_hash: null,
      marketing_consent: reg.marketingConsent,
      // Consent provenance (GDPR Art. 7): stamp WHEN + WHICH version was accepted.
      terms_version: CURRENT_TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
      // Evidencia del art. 103.m: se sella ANTES del pago, que es cuando el
      // usuario lo declaró. La validación ya rechaza el envío sin la casilla,
      // así que aquí siempre hay fecha.
      digital_execution_consent_at: reg.acceptDigitalExecution ? new Date().toISOString() : null,
      marketing_consent_at: reg.marketingConsent ? new Date().toISOString() : null,
      course_id: courseId, amount_expected: amountExpected,
    })
    .select('id')
    .single();
  if (pendingErr || !pending) {
    // El punto más ciego que tenía el repo: este error se capturaba y se usaba
    // solo como booleano, así que no llegaba ni a los logs de Vercel. La fila
    // escribe 17 columnas, y las migraciones se aplican a mano: un despliegue
    // que adelante a su SQL mata el 100% de las ventas nuevas sin una sola
    // señal en ninguna parte.
    alertaCritica('Checkout de la landing: no se pudo crear el registro pendiente, la venta se pierde', {
      courseId,
      codigo: pendingErr?.code,
      mensaje: pendingErr?.message,
    });
    redirect(await back('account_creation_failed'));
  }
  const pendingId = pending.id as string;

  // El embudo solo veía vistas de página, así que "llegó al formulario" y "lo
  // envió" eran el mismo dato: sin distinguirlos no se puede saber si un
  // cambio en el formulario funcionó. No es una ruta real, es un evento con
  // forma de ruta que reutiliza la tabla y el gráfico de embudo que ya
  // existen (utils/admin/landing-queries.ts). Se registra aquí, justo tras
  // el insert del pending: un envío que no pasó la validación nunca llega a
  // este punto y por tanto no cuenta como "enviado".
  //
  // Igual que /api/landing-event: se descarta en modo demo (local/preview
  // escriben en la misma BD que producción y no deben inflar las métricas
  // reales) y cualquier fallo se traga sin propagar — la analítica nunca
  // puede tumbar una compra.
  if (!isDemoMode()) {
    try {
      const visitorHash = dailyVisitorHash(ip, hdrs.get('user-agent'), new Date());
      if (visitorHash) {
        const { error: eventErr } = await admin.from('landing_events')
          .insert({ path: '/curso-bachatango/comprar/enviado', visitor_hash: visitorHash });
        if (eventErr) console.error('[landingCheckout] landing_events insert failed', { message: eventErr.message });
      }
    } catch (e) {
      console.error('[landingCheckout] landing_events unexpected', e);
    }
  }

  // Demo/test: provision inline (simulate the webhook) behind the prod guard.
  // On ANY handled failure or guard refusal, delete the pending row (it holds
  // PII) — never leave it for the 30-day cron.
  if (await isTestPurchaseMode()) {
    const triggeredByAdminCookie = await readTestCookie();
    if (!canProvisionInline({ triggeredByAdminCookie, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL })) {
      await admin.from('pending_registrations').delete().eq('id', pendingId);
      redirect(await back('account_creation_failed'));
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
      redirect(await back('account_creation_failed'));
    }
    redirect(`/gracias?demo=1&email=${encodeURIComponent(reg.email)}`);
  }

  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  let url: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      // CANDADO (AUDITORIA-2026-07 B12): solo 'card'. Si algún día se añaden
      // métodos de pago diferidos (SEPA, Klarna…), hay que implementar ANTES el
      // handler de checkout.session.async_payment_succeeded en el webhook —
      // hoy una sesión completed con payment_status 'unpaid' se descarta (200)
      // y el pago diferido nunca aprovisionaría.
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
    alertaCritica('Checkout de la landing: Stripe no devolvió sesión, la venta se pierde', {
      courseId,
      mensaje: e instanceof Error ? e.message : String(e),
    });
  }
  if (!url) {
    // Stripe session couldn't be created — delete the just-inserted pending row
    // (PII) instead of leaving it for the 30-day cron.
    await admin.from('pending_registrations').delete().eq('id', pendingId);
    redirect(await back('stripe'));
  }
  redirect(url);
}
