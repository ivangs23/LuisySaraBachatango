import 'server-only'
import { unstable_cache } from 'next/cache'
import { createSupabaseAdmin } from '@/utils/supabase/admin'

export type LessonSidebarRow = {
  id: string
  title: string
  order: number
  parent_lesson_id: string | null
  is_free: boolean
}

// Uses the service-role client: unstable_cache forbids reading cookies(), which
// the user-session client does. The sidebar exposes only non-sensitive per-course
// metadata; per-lesson access is enforced on the lesson page via RLS, so a
// shared cache across users is correct here.
export const getCachedLessonsForCourse = (courseId: string) =>
  unstable_cache(
    async (): Promise<LessonSidebarRow[]> => {
      const supabase = createSupabaseAdmin()
      const { data } = await supabase
        .from('lessons')
        .select('id, title, order, parent_lesson_id, is_free')
        .eq('course_id', courseId)
        .order('order', { ascending: true })
      return (data ?? []).map(row => ({ ...row, is_free: row.is_free ?? false }))
    },
    ['lessons-sidebar', courseId],
    { revalidate: 300, tags: [`course:${courseId}:lessons`] }
  )()
