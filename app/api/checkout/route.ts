import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { stripe } from '@/utils/stripe/server';
import { STRIPE_CONFIG } from '@/utils/stripe/config';
import { NextResponse } from 'next/server';
import { rateLimit, rateLimitKey } from '@/utils/rate-limit';
import { getClientIp } from '@/utils/auth/client-ip';

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

    // Guest checkout: se permite comprar sin sesión SI hay courseId.
    // Sin sesión y sin courseId no hay nada que hacer.
    if (!user && !courseId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Origin canónico para success_url (asertado en prod). Un Origin malicioso
    // no debe poder redirigir tras el pago.
    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? '';

    if (!courseId) {
      return NextResponse.json({ error: 'Falta courseId' }, { status: 400 });
    }

    // Datos públicos del curso (RLS permite leer publicados sin sesión).
    const { data: course } = await supabase
      .from('courses')
      .select('title, price_eur, is_published')
      .eq('id', courseId)
      .eq('is_published', true)
      .single();

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    if (!course.price_eur || course.price_eur <= 0) {
      return NextResponse.json({ error: 'Este curso no tiene precio configurado' }, { status: 400 });
    }
    if (course.price_eur > 10000) {
      return NextResponse.json({ error: 'Precio del curso inválido' }, { status: 400 });
    }

    const lineItems = [{
      price_data: {
        currency: STRIPE_CONFIG.CURRENCY,
        unit_amount: Math.round(course.price_eur * 100),
        product_data: { name: course.title },
      },
      quantity: 1,
    }];

    if (user) {
      // ── Comprador logueado: reutiliza/crea customer y marca userId ──────────
      const supabaseAdmin = createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();

      let customerId: string | undefined = profile?.stripe_customer_id ?? undefined;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        });
        const { data: updated } = await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: customer.id })
          .eq('id', user.id)
          .is('stripe_customer_id', null)
          .select('stripe_customer_id')
          .maybeSingle();
        if (updated?.stripe_customer_id) {
          customerId = updated.stripe_customer_id;
        } else {
          const { data: existing } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();
          customerId = existing?.stripe_customer_id ?? customer.id;
        }
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        billing_address_collection: 'auto',
        line_items: lineItems,
        mode: 'payment',
        success_url: `${origin}/profile?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/courses/${courseId}`,
        metadata: { userId: user.id, courseId },
      });

      return NextResponse.json({ sessionId: session.id, url: session.url });
    }

    // ── Comprador invitado (sin cuenta): Stripe recoge el email ───────────────
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      customer_creation: 'always',
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/curso-bachatango`,
      metadata: { courseId, guest: '1' },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });

  } catch (err: unknown) {
    console.error('[checkout]', err);
    return NextResponse.json({ error: 'Error al procesar el pago. Inténtalo de nuevo.' }, { status: 500 });
  }
}
