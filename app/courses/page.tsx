import type { Metadata } from 'next';
import CoursesClient from '@/components/CoursesClient'
import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/utils/supabase/get-user'
import { unstable_cache } from 'next/cache'

// Shared cache for the published courses list — same for all users.
// Uses the anon key (no cookies) because unstable_cache cannot call cookies() internally.
// RLS still applies: anon role can read published courses.
// Revalidate every 5 minutes, or call revalidateTag('courses') after an admin publishes/edits.
const getPublishedCourses = unstable_cache(
  async () => {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, description, image_url, month, year, is_published, course_type, category, price_eur, stripe_price_id')
      .eq('is_published', true)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    if (error) console.error('Error fetching courses:', error)
    return data ?? []
  },
  ['published-courses'],
  { revalidate: 300, tags: ['courses'] }
)

export const metadata: Metadata = {
  title: "Cursos",
  description: "Explora todos los cursos de Bachata y Bachatango de Luis y Sara. Cursos mensuales con suscripción y cursos completos disponibles para compra individual.",
  openGraph: {
    title: "Cursos | Luis y Sara Bachatango",
    description: "Explora todos los cursos de Bachata y Bachatango de Luis y Sara.",
    url: "/courses",
    images: [{ url: '/luis-sara-about.jpg', width: 1200, height: 630, alt: 'Cursos de Bachatango con Luis y Sara' }],
  },
  alternates: { canonical: "/courses" },
};

export default async function CoursesPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  // Courses list is shared across all users — served from cache.
  const courses = await getPublishedCourses()

  let isAdmin = false
  const accessibleCourseIds: string[] = []

  if (user) {
    // Fetch role, purchases and subscriptions in parallel.
    const [profileResult, purchasesResult, subscriptionsResult] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('course_purchases').select('course_id').eq('user_id', user.id),
      supabase.from('subscriptions')
        .select('current_period_start, current_period_end')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing']),
    ])

    isAdmin = profileResult.data?.role === 'admin'

    if (isAdmin) {
      courses.forEach(c => accessibleCourseIds.push(c.id))
    } else {
      // 1. Direct course purchases
      purchasesResult.data?.forEach(p => accessibleCourseIds.push(p.course_id))

      // 2. Subscription-covered membership courses
      const subscriptions = subscriptionsResult.data
      if (subscriptions && subscriptions.length > 0) {
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
      courses={courses}
      isAdmin={isAdmin}
      accessibleCourseIds={accessibleCourseIds}
    />
  )
}
