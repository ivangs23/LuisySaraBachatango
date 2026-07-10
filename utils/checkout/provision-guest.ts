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
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
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
  const { error: purchaseError } = await admin
    .from('course_purchases')
    .upsert(
      {
        user_id: userId,
        course_id: courseId,
        stripe_session_id: session.id,
        amount_paid: session.amount_total ?? null,
      },
      { onConflict: 'stripe_session_id', ignoreDuplicates: true },
    );
  if (purchaseError) return { ok: false, reason: `purchase-error:${purchaseError.message}` };

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
