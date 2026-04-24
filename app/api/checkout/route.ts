import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { stripe } from '@/utils/stripe/server';
import { STRIPE_CONFIG } from '@/utils/stripe/config';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { courseId } = await req.json() as { courseId?: string };
    const origin = req.headers.get('origin') ?? '';

    // Retrieve or create Stripe customer to avoid duplicates
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
      customerId = customer.id;
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // ── Course purchase (one-time, dynamic price) ─────────────────────
    if (courseId) {
      const { data: course } = await supabase
        .from('courses')
        .select('title, price_eur')
        .eq('id', courseId)
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

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        billing_address_collection: 'auto',
        line_items: [{
          price_data: {
            currency: STRIPE_CONFIG.CURRENCY,
            unit_amount: Math.round(course.price_eur * 100), // euros → céntimos
            product_data: { name: course.title },
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${origin}/profile?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/courses/${courseId}`,
        metadata: { userId: user.id, courseId },
      });

      return NextResponse.json({ sessionId: session.id, url: session.url });
    }

    return NextResponse.json({ error: 'Falta courseId' }, { status: 400 });

  } catch (err: unknown) {
    console.error('[checkout]', err);
    return NextResponse.json({ error: 'Error al procesar el pago. Inténtalo de nuevo.' }, { status: 500 });
  }
}
