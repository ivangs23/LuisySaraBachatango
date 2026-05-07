'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/utils/auth/require-admin'
// Lives in _lib because 'use server' modules cannot export sync helpers.
import { parseEventForm } from '@/app/events/_lib/parse'

async function ensureAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin()
    return { ok: true }
  } catch {
    return { ok: false, error: 'No autorizado' }
  }
}

export async function createEvent(formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const parsed = parseEventForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('events')
    .insert(parsed.payload)
    .select('id')
    .single()

  if (error) {
    console.error('[createEvent] insert failed', error)
    return { error: error.message }
  }

  revalidatePath('/events')
  revalidatePath('/admin/eventos')
  redirect('/admin/eventos')
}

export async function updateEvent(id: string, formData: FormData): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const parsed = parseEventForm(formData)
  if ('error' in parsed) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('events')
    .update(parsed.payload)
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return { error: 'Evento no encontrado' }
    }
    console.error('[updateEvent] update failed', { id, error })
    return { error: error.message }
  }

  revalidatePath('/events')
  revalidatePath('/admin/eventos')
  redirect('/admin/eventos')
}

export async function deleteEvent(id: string): Promise<{ error: string } | void> {
  const auth = await ensureAdmin()
  if (!auth.ok) return { error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase.from('events').delete().eq('id', id)

  if (error) {
    console.error('[deleteEvent] delete failed', { id, error })
    return { error: error.message }
  }

  revalidatePath('/events')
  revalidatePath('/admin/eventos')
}

// Wrapper for `<form action={deleteEventForm.bind(null, id)}>` — Next.js form actions are
// invoked with a FormData arg we don't need. Underscore-prefixed; suppress the lint rule.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteEventForm(id: string, _formData?: FormData): Promise<void> {
  await deleteEvent(id)
}
