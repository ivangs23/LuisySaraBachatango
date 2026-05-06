'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { createClient } from '@/utils/supabase/server'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { assertProdEnv } from '@/utils/env/validate-prod'

assertProdEnv()

export async function login(formData: FormData) {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? 'anon').split(',')[0]?.trim() || 'anon'
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
    redirect('/login?error=invalid_credentials')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? 'anon').split(',')[0]?.trim() || 'anon'
  const rl = await rateLimit(rateLimitKey([ip, 'signup']), 3, 15 * 60_000) // 3 per 15min per IP
  if (!rl.ok) {
    redirect('/login?error=rate_limit')
  }

  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

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
    redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback?next=/reset-password`,
  })

  // Always redirect to the same destination — whether the email exists or not —
  // to avoid leaking account existence (oracle).
  if (error) {
    console.error('[resetPassword] internal error', error.message)
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=email_reset')
}
