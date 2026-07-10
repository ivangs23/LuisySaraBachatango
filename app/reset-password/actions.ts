'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'
import { MIN_PASSWORD_LENGTH } from '@/app/login/actions'

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()

  // The set-password session comes from the invite/recovery link via
  // /auth/callback, which exchanges the code and sets the session cookie.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const password = (formData.get('password') as string | null) ?? ''

  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect('/reset-password?error=password_too_short')
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect('/reset-password?error=update_failed')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
