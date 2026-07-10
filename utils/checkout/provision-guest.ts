import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ProvisionResult = { ok: true; userId: string } | { ok: false; reason: string };

/**
 * Provisiona una compra de invitado: resuelve (o crea) el usuario Supabase a
 * partir del email de la sesión de Stripe y registra la compra en
 * course_purchases. Idempotente: reintentos de Stripe encuentran al usuario ya
 * creado y no duplican la compra (upsert on stripe_session_id). Un fallo de
 * envío del email de invitación NO impide registrar la compra si el usuario
 * llegó a crearse (re-lookup por email).
 *
 * `admin` debe ser un cliente Supabase con service role (bypassa RLS).
 */
export async function provisionGuestPurchase(
  session: Stripe.Checkout.Session,
  admin: SupabaseClient,
  opts: { isDemo?: boolean } = {},
): Promise<ProvisionResult> {
  const email = session.customer_details?.email?.toLowerCase();
  const courseId = session.metadata?.courseId;
  if (!email) return { ok: false, reason: 'no-email' };
  if (!courseId) return { ok: false, reason: 'no-course' };

  // 1. ¿Usuario existente? (profiles.email lo pobla el trigger handle_new_user)
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let userId: string | undefined = existing?.id;

  // 2. Crear + invitar si es nuevo
  if (!userId) {
    const redirectTo = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/auth/callback?next=/reset-password`;
    const inviteOptions: { redirectTo: string; data?: Record<string, unknown> } = { redirectTo };
    if (opts.isDemo) inviteOptions.data = { is_demo: true };
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
    if (invited?.user?.id) {
      userId = invited.user.id;
    } else {
      // Carrera: otra entrega ya creó el user (o el email falló pero el user existe).
      const { data: reFetched } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      userId = reFetched?.id;
      if (!userId) {
        return { ok: false, reason: `invite-failed:${inviteError?.message ?? 'unknown'}` };
      }
    }
  }

  // 3. Registrar compra (idempotente sobre stripe_session_id)
  const purchase: Record<string, unknown> = {
    user_id: userId,
    course_id: courseId,
    stripe_session_id: session.id,
    amount_paid: session.amount_total ?? null,
  };
  if (opts.isDemo) purchase.is_demo = true;

  const { error: purchaseError } = await admin
    .from('course_purchases')
    .upsert(purchase, { onConflict: 'stripe_session_id', ignoreDuplicates: true });
  if (purchaseError) {
    // course_purchases also has UNIQUE(user_id, course_id). A repeat purchase
    // of the same course by the same user (different stripe_session_id) hits
    // that constraint instead of the onConflict target above — the user
    // already owns the course, so treat it as idempotent success rather than
    // failing the webhook and triggering a Stripe retry storm.
    if (purchaseError.code === '23505') return { ok: true, userId };
    return { ok: false, reason: `purchase-error:${purchaseError.message}` };
  }

  // 4. Vincular stripe_customer_id si viene y no está puesto
  if (session.customer) {
    await admin
      .from('profiles')
      .update({ stripe_customer_id: session.customer as string })
      .eq('id', userId)
      .is('stripe_customer_id', null);
  }

  return { ok: true, userId };
}
