'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requireAdmin } from '@/utils/auth/require-admin'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { sendPurchaseConfirmation } from '@/utils/email/purchase-confirmation'
import { sendFreeClassesEmail } from '@/utils/email/free-classes'
import { setPasswordUrl } from '@/utils/checkout/set-password-url'
import { normaliseEmail } from '@/utils/newsletter/subscribe'
import { EMAIL_STATUS_TAG } from '@/utils/admin/email-status'

export type ReenvioResult = { ok: true } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NO_ACEPTADO = 'Resend no aceptó el correo. Mira el aviso de arriba de la página.'

function refrescar() {
  // updateTag y no revalidateTag: el aviso del menú tiene que cambiar ya, en
  // la misma vuelta, no en la siguiente visita.
  updateTag(EMAIL_STATUS_TAG)
  revalidatePath('/admin/correos')
}

/**
 * Manda a mano el correo de compra.
 *
 * Quien todavía no ha entrado nunca recibe un enlace NUEVO para crear su
 * contraseña: el del primer correo, si llegó a salir, puede haber caducado, y
 * generar uno nuevo invalida el anterior. Quien ya ha entrado recibe la
 * versión de «entra con tu contraseña de siempre».
 */
export async function resendPurchaseEmail(purchaseId: string): Promise<ReenvioResult> {
  await requireAdmin()
  if (!UUID.test(purchaseId)) return { ok: false, error: 'Compra no válida.' }

  const sb = createSupabaseAdmin()
  const { data: compra } = await sb
    .from('course_purchases').select('user_id, is_demo, refunded_at').eq('id', purchaseId).maybeSingle()
  if (!compra) return { ok: false, error: 'No encuentro esa compra.' }
  if (compra.is_demo) return { ok: false, error: 'Es una compra de prueba.' }
  if (compra.refunded_at) return { ok: false, error: 'Está reembolsada: ya no tiene acceso al curso.' }

  const { data: perfil } = await sb
    .from('profiles').select('email, full_name').eq('id', compra.user_id).maybeSingle()
  const email = perfil?.email ? String(perfil.email).toLowerCase() : null
  if (!email) return { ok: false, error: 'La cuenta no tiene email.' }

  const { data: auth } = await sb.auth.admin.getUserById(compra.user_id as string)
  const haEntrado = !!auth?.user?.last_sign_in_at

  let enlace: string | undefined
  if (!haEntrado) {
    const { data: link } = await sb.auth.admin.generateLink({ type: 'recovery', email })
    const th = link?.properties?.hashed_token
    // Sin enlace el correo manda a «¿Olvidaste tu contraseña?», que también
    // sirve para entrar: mejor eso que no mandar nada.
    if (th) enlace = setPasswordUrl(th)
  }

  const ok = await sendPurchaseConfirmation({
    email,
    fullName: (perfil?.full_name as string | null) ?? null,
    existingAccount: haEntrado,
    setPasswordUrl: enlace,
    accountHasNoPassword: !haEntrado || undefined,
  })
  if (!ok) return { ok: false, error: NO_ACEPTADO }
  refrescar()
  return { ok: true }
}

/**
 * Manda a mano el correo de las dos clases gratis. Es correo comercial: solo a
 * quien se apuntó desde ese formulario y no se ha dado de baja.
 */
export async function resendFreeClassesEmail(rawEmail: string): Promise<ReenvioResult> {
  await requireAdmin()
  const email = normaliseEmail(rawEmail)
  if (!email) return { ok: false, error: 'Email no válido.' }

  const sb = createSupabaseAdmin()
  const { data: alta } = await sb
    .from('newsletter_subscribers').select('consent_source, unsubscribed_at').eq('email', email).maybeSingle()
  if (!alta || alta.consent_source !== 'clase_gratis') return { ok: false, error: 'No se apuntó a las clases gratis.' }
  if (alta.unsubscribed_at) return { ok: false, error: 'Se dio de baja: no se le puede mandar.' }

  if (!(await sendFreeClassesEmail(email))) return { ok: false, error: NO_ACEPTADO }
  refrescar()
  return { ok: true }
}
