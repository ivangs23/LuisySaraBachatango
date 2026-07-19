import { headers } from 'next/headers';
import { stripe } from '@/utils/stripe/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { assertProdEnv } from '@/utils/env/validate-prod';
import { provisionGuestPurchase } from '@/utils/checkout/provision-guest';
import { provisionFromPending } from '@/utils/checkout/provision-registration';

assertProdEnv();

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

    // New landing registration flow: pendingId carried in client_reference_id
    // (mirrored in metadata.pendingId). Provision the account from the pending
    // row. Takes precedence over the legacy guest branch.
    const pendingId = session.client_reference_id ?? session.metadata?.pendingId;
    if (pendingId) {
      const result = await provisionFromPending(session, supabase);
      if (!result.ok) {
        console.error('Webhook: pending provisioning failed:', result.reason, 'session:', session.id);
        // Non-retryable reasons (validation/idempotent) -> 200. DB/create errors -> 500 for Stripe retry.
        const nonRetryable = ['not-paid', 'bad-amount', 'no-pending-id', 'no-course'];
        if (nonRetryable.includes(result.reason)) return new NextResponse(null, { status: 200 });
        return new NextResponse('Provisioning Error', { status: 500 });
      }
      return new NextResponse(null, { status: 200 });
    }

    if (!userId) {
      // Guest checkout: no hay userId; se provisiona por email tras el pago.
      if (session.metadata?.guest === '1' && courseId && session.payment_status === 'paid') {
        const result = await provisionGuestPurchase(session, supabase, {
          source: session.metadata?.source,
          fullName: session.metadata?.fullName,
        });
        if (!result.ok) {
          console.error('Webhook: guest provisioning failed:', result.reason, 'session:', session.id);
          // Falta de email/curso → no reintentar (200). Errores de DB/invite → 500.
          if (result.reason === 'no-email' || result.reason === 'no-course') {
            return new NextResponse(null, { status: 200 });
          }
          return new NextResponse('Provisioning Error', { status: 500 });
        }
        return new NextResponse(null, { status: 200 });
      }
      // Sesión completed sin metadata reconocida (p. ej. un Payment Link o un
      // checkout creado a mano en el dashboard sobre la misma cuenta Stripe).
      // 200, no 400: un 4xx haría a Stripe reintentar durante días y marcar el
      // endpoint como failing por eventos que no son de esta app.
      console.warn('Webhook: checkout.session.completed sin metadata de la app — ignorada. session:', session.id);
      return new NextResponse(null, { status: 200 });
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
              stripe_payment_intent: typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id ?? null,
              amount_paid: session.amount_total ?? null,
              source: session.metadata?.source ?? 'web',
            },
            { onConflict: 'stripe_session_id', ignoreDuplicates: true }
          );

        // 23505 = UNIQUE(user_id,course_id): el usuario ya posee el curso →
        // idempotente (200), no 500 (que provocaría reintentos infinitos de Stripe).
        if (error && error.code !== '23505') {
          console.error('Error saving course purchase:', error);
          return new NextResponse('Database Error', { status: 500 });
        }
      }
    } else {
      // Subscription purchase — upsert on subscription ID is already idempotent
      // session.subscription may be a string (not expanded) or an expanded
      // Stripe.Subscription object (we now request expansion at checkout
      // creation time). Normalize both cases.
      const rawSubscription = session.subscription;
      let subscription: Stripe.Subscription | null = null;
      let subscriptionId: string | null = null;

      if (typeof rawSubscription === 'string') {
        subscriptionId = rawSubscription;
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
      } else if (rawSubscription) {
        subscription = rawSubscription;
        subscriptionId = rawSubscription.id;
      }

      if (subscriptionId && subscription) {
        const item = subscription.items.data[0];
        if (!item || !item.current_period_start || !item.current_period_end) {
          console.error('Webhook: subscription has no usable item', { subscriptionId });
          return new NextResponse(null, { status: 200 });
        }

        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            id: subscriptionId,
            user_id: userId,
            status: subscription.status,
            plan_type: item.price.id,
            current_period_start: new Date(item.current_period_start * 1000).toISOString(),
            current_period_end: new Date(item.current_period_end * 1000).toISOString(),
          });

        if (error) {
          console.error('Error saving subscription:', error);
          return new NextResponse('Database Error', { status: 500 });
        }
      }
    }
  }

  // ==========================================================================
  // Reembolsos y disputas (AUDITORIA-2026-07 A3): revocan el acceso marcando
  // refunded_at en course_purchases. hasCourseAccess y las policies RLS
  // filtran `refunded_at is null`.
  // Política (decisión 2026-07): solo el reembolso TOTAL revoca; el parcial
  // (gesto comercial) mantiene el acceso. Una disputa revoca al abrirse y se
  // restaura si se gana (dispute.closed, status=won).
  // ==========================================================================
  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    let paymentIntent: string | null = null;

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      // Reembolso parcial → mantener acceso (no-op idempotente).
      if (charge.amount_refunded < charge.amount) {
        return new NextResponse(null, { status: 200 });
      }
      paymentIntent = typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id ?? null;
    } else {
      const dispute = event.data.object as Stripe.Dispute;
      paymentIntent = typeof dispute.payment_intent === 'string'
        ? dispute.payment_intent
        : dispute.payment_intent?.id ?? null;
    }

    if (!paymentIntent) {
      // Cargo sin payment_intent (no debería darse en Checkout) — nada que hacer.
      console.warn('Webhook: refund/dispute sin payment_intent. event:', event.id);
      return new NextResponse(null, { status: 200 });
    }

    const revokedAt = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('course_purchases')
      .update({ refunded_at: revokedAt })
      .eq('stripe_payment_intent', paymentIntent)
      .is('refunded_at', null)
      .select('id');

    if (error) {
      console.error('Webhook: error marcando refunded_at:', error);
      return new NextResponse('Database Error', { status: 500 });
    }

    // Compra anterior a la columna stripe_payment_intent: resolver la sesión
    // de Checkout desde Stripe y marcar por stripe_session_id.
    if (!updated || updated.length === 0) {
      const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
      const sessionId = sessions.data[0]?.id;
      if (sessionId) {
        const { data: legacyUpdated, error: legacyErr } = await supabase
          .from('course_purchases')
          .update({ refunded_at: revokedAt, stripe_payment_intent: paymentIntent })
          .eq('stripe_session_id', sessionId)
          .is('refunded_at', null)
          .select('id');
        if (legacyErr) {
          console.error('Webhook: error marcando refunded_at (fallback sesión):', legacyErr);
          return new NextResponse('Database Error', { status: 500 });
        }
        console.warn('[refund] %s pi=%s session=%s filas=%d', event.type, paymentIntent, sessionId, legacyUpdated?.length ?? 0);
      } else {
        // Reembolso de un pago que no es una compra de curso (p. ej. futura
        // suscripción) o ya marcado — idempotente.
        console.warn('[refund] %s pi=%s sin compra asociada', event.type, paymentIntent);
      }
    } else {
      console.warn('[refund] %s pi=%s acceso revocado (filas=%d)', event.type, paymentIntent, updated.length);
    }
    return new NextResponse(null, { status: 200 });
  }

  if (event.type === 'charge.dispute.closed') {
    const dispute = event.data.object as Stripe.Dispute;
    if (dispute.status === 'won') {
      const paymentIntent = typeof dispute.payment_intent === 'string'
        ? dispute.payment_intent
        : dispute.payment_intent?.id ?? null;
      if (paymentIntent) {
        const { error } = await supabase
          .from('course_purchases')
          .update({ refunded_at: null })
          .eq('stripe_payment_intent', paymentIntent);
        if (error) {
          console.error('Webhook: error restaurando acceso tras disputa ganada:', error);
          return new NextResponse('Database Error', { status: 500 });
        }
        console.warn('[dispute-won] pi=%s acceso restaurado', paymentIntent);
      }
    }
    return new NextResponse(null, { status: 200 });
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const pendingId = session.client_reference_id ?? session.metadata?.pendingId;
    if (pendingId) {
      await supabase.from('pending_registrations').delete().eq('id', pendingId);
    }
    return new NextResponse(null, { status: 200 });
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data.object as Stripe.Subscription;

    const item = subscription.items.data[0];
    if (!item || !item.current_period_start || !item.current_period_end) {
      console.error('Webhook: subscription event with no usable item', { id: subscription.id });
      return new NextResponse(null, { status: 200 });
    }

    // userId from metadata (set by /api/checkout). May be missing on raw
    // sub events; if so, omit from upsert payload so an existing user_id
    // is preserved on update.
    const userId = (subscription.metadata?.userId as string | undefined) ?? null;

    // Upsert (not update) so out-of-order events still establish the row.
    // For `deleted`, we still upsert to mark status='canceled' authoritatively.
    const payload: Record<string, unknown> = {
      id: subscription.id,
      status: subscription.status,
      plan_type: item.price.id,
      current_period_start: new Date(item.current_period_start * 1000).toISOString(),
      current_period_end: new Date(item.current_period_end * 1000).toISOString(),
    };
    if (userId) payload.user_id = userId;

    const { error } = await supabase
      .from('subscriptions')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting subscription:', error);
      return new NextResponse('Database Error', { status: 500 });
    }
  }

  return new NextResponse(null, { status: 200 });
}
