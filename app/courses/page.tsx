import CoursesClient from '@/components/CoursesClient'
import { createClient } from '@/utils/supabase/server'

export default async function CoursesPage() {
  const supabase = await createClient()

  const { data: courses, error } = await supabase
    .from('courses')
    .select('id, title, description, image_url, month, year, is_published, course_type, category, price_eur, stripe_price_id')
    .eq('is_published', true)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) {
    console.error('Error fetching courses:', error)
  }

  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  const accessibleCourseIds: string[] = []

  if (user) {
    // Fetch user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    isAdmin = profile?.role === 'admin'

    if (isAdmin) {
      // Admin can access all courses
      courses?.forEach(c => accessibleCourseIds.push(c.id))
    } else {
      // 1. Direct course purchases
      const { data: purchases } = await supabase
        .from('course_purchases')
        .select('course_id')
        .eq('user_id', user.id)

      purchases?.forEach(p => accessibleCourseIds.push(p.course_id))

      // 2. Subscription-covered membership courses
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('current_period_start, current_period_end')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])

      if (subscriptions && subscriptions.length > 0 && courses) {
        for (const course of courses) {
          if (course.course_type !== 'membership') continue
          if (accessibleCourseIds.includes(course.id)) continue
          if (!course.year || !course.month) continue

          const courseFirstDay = new Date(Date.UTC(course.year, course.month - 1, 1))
          const courseLastDay = new Date(Date.UTC(course.year, course.month, 0, 23, 59, 59))

          const covered = subscriptions.some(sub => {
            if (!sub.current_period_start || !sub.current_period_end) return false
            const start = new Date(sub.current_period_start)
            const end = new Date(sub.current_period_end)
            return start <= courseLastDay && end >= courseFirstDay
          })

          if (covered) accessibleCourseIds.push(course.id)
        }
      }
    }
  }

  return (
    <CoursesClient
      courses={courses || []}
      isAdmin={isAdmin}
      accessibleCourseIds={accessibleCourseIds}
    />
  )
}
