import 'server-only'
import { createClient } from '@/utils/supabase/server'

/**
 * Returns true if the user has any of:
 * - admin role
 * - one-time course_purchase for this course
 * - active or trialing subscription whose period covers the course month/year
 *
 * Mirrors the gating logic of the lesson page server component.
 */
export async function hasCourseAccess(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const supabase = await createClient()

  // Admin shortcut.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.role === 'admin') return true

  // Course must exist (and gives us month/year for sub coverage).
  const { data: course } = await supabase
    .from('courses')
    .select('id, month, year')
    .eq('id', courseId)
    .single()
  if (!course) return false

  // One-time purchase.
  const { data: purchase } = await supabase
    .from('course_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle()
  if (purchase) return true

  // Active subscription covering the course month.
  const courseFirstDay = new Date(Date.UTC(course.year, course.month - 1, 1)).toISOString()
  const courseLastDay = new Date(Date.UTC(course.year, course.month, 0, 23, 59, 59)).toISOString()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .lte('current_period_start', courseLastDay)
    .gte('current_period_end', courseFirstDay)
    .maybeSingle()

  return !!sub
}
