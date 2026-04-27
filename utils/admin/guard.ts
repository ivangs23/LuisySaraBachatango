import { createClient } from '@/utils/supabase/server'

export class AdminGuardError extends Error {
  constructor(public reason: 'unauthenticated' | 'forbidden' | 'lookup_failed') {
    super(`AdminGuard: ${reason}`)
    this.name = 'AdminGuardError'
  }
}

export type AdminUser = { id: string }

export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AdminGuardError('unauthenticated')

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (error || !data) throw new AdminGuardError('lookup_failed')
  if (data.role !== 'admin') throw new AdminGuardError('forbidden')

  return { id: user.id }
}
