'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { createClient } from '@/utils/supabase/server'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'
import { MIN_PASSWORD_LENGTH } from '@/utils/auth/password'
import { EMAIL_RE } from '@/utils/auth/email'

export async function login(formData: FormData) {
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await rateLimit(rateLimitKey([ip, 'login']), 5, 60_000) // 5/min per IP
  if (!rl.ok) {
    redirect('/login?error=rate_limit')
  }

  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Distinguir "no has confirmado el email" de "contraseña incorrecta".
    // Antes ambos casos decían lo mismo, así que quien no había confirmado
    // creía haberse equivocado de contraseña, intentaba recuperarla —que
    // tampoco desbloquea la cuenta— y se quedaba atrapado sin saber por qué.
    const sinConfirmar =
      (error as { code?: string }).code === 'email_not_confirmed' ||
      /email not confirmed/i.test(error.message)
    redirect(`/login?error=${sinConfirmar ? 'email_not_confirmed' : 'invalid_credentials'}`)
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Reenvía el correo de confirmación de registro.
 *
 * Sin esto, quien no recibiera el primero (spam, error de SMTP, buzón lleno)
 * no tenía ninguna salida por sí mismo: la recuperación de contraseña no
 * confirma la cuenta, así que hacía falta que un administrador lo hiciera a
 * mano en la base de datos.
 *
 * Responde igual exista o no la cuenta: lo contrario convertiría el formulario
 * en un detector de qué emails están registrados.
 */
export async function resendConfirmation(formData: FormData) {
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await rateLimit(rateLimitKey([ip, 'resend-confirmation']), 3, 60 * 60 * 1000)
  if (!rl.ok) redirect('/login?error=rate_limit')

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email) redirect('/login?error=invalid_email')

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  if (error) {
    // Se registra pero no se revela: puede ser simplemente que ese email no
    // exista o que ya esté confirmado.
    console.error('[resendConfirmation] %s', error.message)
  }
  redirect('/login?message=email_confirmation')
}

export async function signup(formData: FormData) {
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await rateLimit(rateLimitKey([ip, 'signup']), 3, 15 * 60_000) // 3 per 15min per IP
  if (!rl.ok) {
    redirect('/login?error=rate_limit')
  }

  const email = ((formData.get('email') as string | null) ?? '').trim()
  const password = (formData.get('password') as string | null) ?? ''
  const fullName = ((formData.get('fullName') as string | null) ?? '').trim()

  if (!EMAIL_RE.test(email)) {
    redirect('/login?error=invalid_email')
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect('/login?error=password_too_short')
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    redirect('/login?error=signup_failed')
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=email_confirmation')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'}/auth/callback?next=/reset-password`,
  })

  // Always redirect to the same destination — whether the email exists or not —
  // to avoid leaking account existence (oracle).
  if (error) {
    console.error('[resetPassword] internal error', error.message)
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=email_reset')
}
