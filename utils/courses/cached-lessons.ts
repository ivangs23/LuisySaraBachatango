import 'server-only'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export type LessonSidebarRow = {
  id: string
  title: string
  order: number
  parent_lesson_id: string | null
  is_free: boolean
}

/**
 * Returns the ordered list of lesson sidebar rows for a course.
 * Result is cached at the Next.js data layer for 5 minutes per courseId,
 * with the tag `course:<courseId>:lessons` so admin mutations can invalidate
 * via `revalidateTag(...)`.
 */
export const getCachedLessonsForCourse = (courseId: string) =>
  unstable_cache(
    async (): Promise<LessonSidebarRow[]> => {
      const supabase = await createClient()
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
