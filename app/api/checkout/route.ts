import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { stripe } from '@/utils/stripe/server';
import { STRIPE_CONFIG } from '@/utils/stripe/config';
import { NextResponse } from 'next/server';
import { rateLimit, rateLimitKey } from '@/utils/rate-limit';
import { getClientIp } from '@/utils/auth/client-ip';
import { isDemoMode } from '@/utils/demo/mode';
import { randomUUID } from 'node:crypto';

export async function POST(req: Request) {
  const ip = getClientIp(req.headers)
  const rl = await rateLimit(rateLimitKey([ip, 'checkout']), 10, 60_000) // 10/min per IP
  if (!rl.ok) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfter) },
    })
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { courseId } = await req.json() as { courseId?: string };

    // /api/checkout es SOLO para la web logueada. La landing usa su propio
    // formulario (/curso-bachatango/comprar → landingCheckout).
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!courseId) {
      return NextResponse.json({ error: 'Falta courseId' }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? '';

    const { data: course } = await supabase
      .from('courses')
      .select('title, price_eur, is_published')
      .eq('id', courseId)
      .eq('is_published', true)
      .single();
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    if (!course.price_eur || course.price_eur <= 0) return NextResponse.json({ error: 'Este curso no tiene precio configurado' }, { status: 400 });
    if (course.price_eur > 10000) return NextResponse.json({ error: 'Precio del curso inválido' }, { status: 400 });

    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Modo demo: simula la compra del usuario logueado (sin Stripe).
    if (isDemoMode()) {
      const { error: demoErr } = await supabaseAdmin.from('course_purchases').upsert(
        { user_id: user.id, course_id: courseId, stripe_session_id: `demo_${randomUUID()}`, amount_paid: Math.round(course.price_eur * 100), is_demo: true, source: 'web' },
        { onConflict: 'stripe_session_id', ignoreDuplicates: true },
      );
      // 23505 = UNIQUE(user_id,course_id): ya posee el curso → éxito idempotente.
      if (demoErr && demoErr.code !== '23505') {
        console.error('[checkout] demo web upsert', demoErr);
        return NextResponse.json({ error: 'Error al simular la compra.' }, { status: 500 });
      }
      return NextResponse.json({ url: `/courses/${courseId}` });
    }

    // Comprador logueado real: reutiliza/crea customer.
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    let customerId: string | undefined = profile?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      const { data: updated } = await supabaseAdmin
        .from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id).is('stripe_customer_id', null).select('stripe_customer_id').maybeSingle();
      if (updated?.stripe_customer_id) {
        customerId = updated.stripe_customer_id;
      } else {
        const { data: existing } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
        customerId = existing?.stripe_customer_id ?? customer.id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      line_items: [{ price_data: { currency: STRIPE_CONFIG.CURRENCY, unit_amount: Math.round(course.price_eur * 100), product_data: { name: course.title } }, quantity: 1 }],
      mode: 'payment',
      success_url: `${origin}/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/courses/${courseId}`,
      metadata: { userId: user.id, courseId, source: 'web' },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });

  } catch (err: unknown) {
    console.error('[checkout]', err);
    return NextResponse.json({ error: 'Error al procesar el pago. Inténtalo de nuevo.' }, { status: 500 });
  }
}
