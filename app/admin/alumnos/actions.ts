'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/utils/admin/guard'
import { createSupabaseAdmin } from '@/utils/supabase/admin'

const ROLES = ['member', 'premium', 'admin'] as const
type Role = (typeof ROLES)[number]

export async function updateUserRole(userId: string, role: Role) {
  await requireAdmin()
  if (!ROLES.includes(role)) throw new Error(`Invalid role: ${role}`)
  if (!userId) throw new Error('userId required')

  const sb = createSupabaseAdmin()
  const { error } = await sb.from('profiles').update({ role }).eq('id', userId)
  if (error) throw error
  revalidatePath(`/admin/alumnos/${userId}`)
  revalidatePath('/admin/alumnos')
}

export async function grantCourseAccess(userId: string, courseId: string) {
  await requireAdmin()
  if (!userId || !courseId) throw new Error('userId and courseId required')
  const sb = createSupabaseAdmin()
  const stripeSession = `manual_admin_${crypto.randomUUID()}`
  const { error } = await sb.from('course_purchases').insert({
    user_id: userId,
    course_id: courseId,
    stripe_session_id: stripeSession,
    amount_paid: 0,
  })
  // Idempotent on (user_id, course_id) UNIQUE — duplicate is fine
  if (error && error.code !== '23505') throw error
  revalidatePath(`/admin/alumnos/${userId}`)
}

export async function sendNotification(userId: string, title: string, body: string) {
  await requireAdmin()
  const t = title.trim().slice(0, 200)
  const b = body.trim().slice(0, 1000)
  if (!t) throw new Error('Title required')
  if (!userId) throw new Error('userId required')
  const sb = createSupabaseAdmin()
  const { error } = await sb.from('notifications').insert({
    user_id: userId,
    title: t,
    body: b,
    type: 'admin_message',
  })
  if (error) throw error
  revalidatePath(`/admin/alumnos/${userId}`)
}

export async function deleteUser(userId: string, confirmPhrase: string, targetEmail: string) {
  const me = await requireAdmin()
  if (confirmPhrase !== 'ELIMINAR') throw new Error('Confirmation phrase required')
  if (userId === me.id) throw new Error('Cannot delete yourself')

  const normalizedEmail = targetEmail.trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Email del usuario requerido')

  const sb = createSupabaseAdmin()

  const { data: target, error: lookupError } = await sb
    .from('profiles')
    .select('id, email')
    .eq('id', userId)
    .single()

  if (lookupError || !target) throw new Error('Usuario no encontrado')

  if (!target.email || target.email.toLowerCase() !== normalizedEmail) {
    throw new Error('El email no coincide con el usuario seleccionado')
  }

  const { error } = await sb.auth.admin.deleteUser(userId)
  if (error) throw error
  revalidatePath('/admin/alumnos')
}
