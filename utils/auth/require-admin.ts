import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'
import type { User } from '@supabase/supabase-js'

type AppRole = 'member' | 'premium' | 'admin'

type CurrentRoleResult = {
  user: User | null
  role: AppRole | null
}

/**
 * Memoized per-request lookup of the current user's role.
 * `react/cache` deduplicates calls within a single React render cycle,
 * so multiple server actions or server components hitting this in the same
 * request share one DB round-trip.
 */
export const getCurrentRole = cache(async (): Promise<CurrentRoleResult> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return { user, role: (profile?.role as AppRole | undefined) ?? 'member' }
})

export class AdminGuardError extends Error {
  constructor(public reason: 'unauthenticated' | 'forbidden' | 'lookup_failed') {
    super(`AdminGuard: ${reason}`)
    this.name = 'AdminGuardError'
  }
}

export type AdminUser = { id: string }

/**
 * Server-only guard. Throws AdminGuardError if no user or not admin.
 * Returns { id } of the authenticated admin user on success.
 * Uses `getCurrentRole` (memoized) so multiple calls per request are free.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const { user, role } = await getCurrentRole()
  if (!user) throw new AdminGuardError('unauthenticated')
  if (role !== 'admin') throw new AdminGuardError('forbidden')
  return { id: user.id }
}
