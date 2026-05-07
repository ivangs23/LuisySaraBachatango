'use server'

import { headers } from 'next/headers'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_MAX = 100
const MESSAGE_MAX = 5000
const TYPE_MAX = 50

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function submitContact(formData: FormData): Promise<{ success: true } | { error: string }> {
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await rateLimit(rateLimitKey([ip, 'contact']), 5, 60 * 60 * 1000)
  if (!rl.ok) return { error: 'rate_limit' }

  const name = String(formData.get('name') ?? '').trim().slice(0, NAME_MAX)
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const message = String(formData.get('message') ?? '').trim().slice(0, MESSAGE_MAX)
  const inquiryType = String(formData.get('type') ?? 'general').trim().slice(0, TYPE_MAX)

  if (!name) return { error: 'name_required' }
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email' }
  if (message.length < 10) return { error: 'message_too_short' }

  const { error } = await adminClient()
    .from('contact_submissions')
    .insert({ name, email, message, inquiry_type: inquiryType })

  if (error) {
    console.error('[submitContact] db error', { code: error.code, message: error.message })
    return { error: 'server_error' }
  }

  return { success: true }
}
