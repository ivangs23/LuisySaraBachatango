'use server'

import { headers } from 'next/headers'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function subscribeNewsletter(formData: FormData): Promise<{ success: true } | { error: string }> {
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await rateLimit(rateLimitKey([ip, 'newsletter']), 5, 60 * 60 * 1000)
  if (!rl.ok) return { error: 'rate_limit' }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email' }

  const { error } = await adminClient()
    .from('newsletter_subscribers')
    .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true })

  if (error) {
    console.error('[subscribeNewsletter] db error', { code: error.code, message: error.message })
    return { error: 'server_error' }
  }

  return { success: true }
}
