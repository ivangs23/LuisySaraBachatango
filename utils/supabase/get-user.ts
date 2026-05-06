import 'server-only'
import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Returns the currently authenticated user, memoized via React cache()
 * for the lifetime of a single render pass. Multiple call sites within
 * the same request share one Auth round-trip.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
