import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPurchaseConfirmation } from '@/utils/email/purchase-confirmation'

export type ProvisionResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; reason: string }

/**
 * Provisions a landing purchase from a pending_registrations row after Stripe
 * confirms payment. Idempotent, resolve-or-create, and never sets/overwrites an
 * existing user's password or profile. Op order (strict):
 *   resolve-or-create user -> UPDATE profiles (new user only) -> upsert purchase
 *   -> DELETE pending -> send email (last).
 */
export async function provisionFromPending(
  session: Stripe.Checkout.Session,
  admin: SupabaseClient,
  opts: { isDemo?: boolean } = {},
): Promise<ProvisionResult> {
  // Anti-fraud: only a genuinely paid session provisions. amount_total is
  // recorded (coupons legitimately reduce it); we do NOT require equality with
  // amount_expected, only that it is a valid non-negative integer.
  if (session.payment_status !== 'paid') return { ok: false, reason: 'not-paid' }
  const amount = session.amount_total
  if (typeof amount !== 'number' || amount < 0) return { ok: false, reason: 'bad-amount' }

  const pendingId = session.client_reference_id ?? session.metadata?.pendingId
  if (!pendingId) return { ok: false, reason: 'no-pending-id' }

  const { data: pending } = await admin
    .from('pending_registrations')
    .select('id, email, full_name, password_hash, country, city, date_of_birth, phone, marketing_consent, dance_level, course_id')
    .eq('id', pendingId)
    .maybeSingle()

  // Pending row already consumed (retry after a prior successful delivery) ->
  // idempotent success, do not re-provision.
  if (!pending) return { ok: true, userId: '', created: false }

  const email = String(pending.email).toLowerCase()
  const courseId = pending.course_id as string | null
  if (!courseId) return { ok: false, reason: 'no-course' }

  // Resolve-or-create.
  const { data: existing } = await admin
    .from('profiles').select('id').eq('email', email).maybeSingle()

  let userId: string | undefined = existing?.id
  let created = false

  if (!userId) {
    const userMeta: Record<string, unknown> = { full_name: pending.full_name ?? undefined }
    if (opts.isDemo) userMeta.is_demo = true // reapable by cleanup_demo_data
    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password_hash: pending.password_hash as string,
      email_confirm: true,
      user_metadata: userMeta,
    })
    if (createdUser?.user?.id) {
      userId = createdUser.user.id
      created = true
    } else {
      // Race: another delivery (or a prior signup) created the user between our
      // SELECT and createUser. Re-SELECT and continue — never 500.
      const { data: raced } = await admin
        .from('profiles').select('id').eq('email', email).maybeSingle()
      userId = raced?.id
      if (!userId) return { ok: false, reason: `create-failed:${createErr?.message ?? 'unknown'}` }
      // Fall through as an existing account (do not touch its password/profile).
      created = false
    }
  }

  // New account only: populate the enumerated profile columns. NEVER write
  // password_hash into profiles; NEVER clobber an existing user's fields.
  if (created) {
    await admin.from('profiles').update({
      country: pending.country ?? null,
      city: pending.city ?? null,
      date_of_birth: pending.date_of_birth ?? null,
      phone: pending.phone ?? null,
      marketing_consent: pending.marketing_consent ?? false,
      dance_level: pending.dance_level ?? null,
    }).eq('id', userId)
  }

  if (session.customer) {
    await admin.from('profiles')
      .update({ stripe_customer_id: session.customer as string })
      .eq('id', userId).is('stripe_customer_id', null)
  }

  // Purchase (idempotent). `.select('id')` reveals whether a GENUINE row was
  // inserted (vs an idempotent duplicate) so the email fires exactly once.
  const purchaseRow: Record<string, unknown> = {
    user_id: userId, course_id: courseId, stripe_session_id: session.id, amount_paid: amount, source: 'landing',
  }
  if (opts.isDemo) purchaseRow.is_demo = true
  const { data: inserted, error: purchaseError } = await admin.from('course_purchases')
    .upsert(purchaseRow, { onConflict: 'stripe_session_id', ignoreDuplicates: true })
    .select('id')
  if (purchaseError) {
    // 23505 = UNIQUE(user_id,course_id): user already owns this course via a
    // DIFFERENT session -> double payment, no second product. Idempotent
    // success, but flag distinctively as a refund candidate for ops. No email.
    if (purchaseError.code === '23505') {
      console.error('[double-charge candidate] session=%s user=%s course=%s', session.id, userId, courseId)
      await admin.from('pending_registrations').delete().eq('id', pendingId)
      return { ok: true, userId: userId as string, created }
    }
    return { ok: false, reason: `purchase-error:${purchaseError.message}` }
  }
  const genuineInsert = Array.isArray(inserted) && inserted.length > 0

  // Consume the pending row (last data op).
  await admin.from('pending_registrations').delete().eq('id', pendingId)

  // Email last, exactly once — only on a genuine new purchase insert. A
  // duplicate delivery (empty `inserted`) or an already-owned course does not
  // re-send.
  if (genuineInsert) {
    await sendPurchaseConfirmation({
      email,
      fullName: (pending.full_name as string | null) ?? null,
      existingAccount: !created,
    })
  }

  return { ok: true, userId: userId as string, created }
}
