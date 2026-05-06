import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/supabase/get-user'
import { notFound, redirect } from 'next/navigation'
import LessonView from '@/components/LessonView'
import { signPlaybackTokenForUser, signThumbnailTokenForUser } from '@/utils/mux/server'
import { getCachedLessonsForCourse } from '@/utils/courses/cached-lessons'

export async function generateMetadata(
  props: { params: Promise<{ courseId: string; lessonId: string }> }
): Promise<Metadata> {
  const { courseId, lessonId } = await props.params;
  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from('lessons')
    .select('title, description')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single();

  if (!lesson) return { title: 'Lección' };

  return {
    title: lesson.title,
    description: lesson.description ?? `Lección de Bachatango: ${lesson.title}. Aprende con Luis y Sara.`,
    robots: { index: false, follow: false },
  };
}

export default async function LessonPage(props: { params: Promise<{ courseId: string, lessonId: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser()
  const supabase = await createClient()

  if (!user) {
    redirect('/login')
  }

  // Sidebar lesson list: cached per-course for 5 min (same for every viewer).
  const allLessons = await getCachedLessonsForCourse(params.courseId)

  // Batch 1: all queries that only need lessonId / courseId / userId.
  const [
    { data: lesson, error: lessonError },
    { data: profile },
    { data: course },
    { data: coursePurchase },
    { data: assignment },
  ] = await Promise.all([
    supabase.from('lessons')
      .select('id, title, description, thumbnail_url, mux_playback_id, mux_status, course_id')
      .eq('id', params.lessonId)
      .eq('course_id', params.courseId)
      .single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('courses').select('month, year').eq('id', params.courseId).single(),
    supabase.from('course_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', params.courseId)
      .maybeSingle(),
    supabase.from('assignments')
      .select('id, title, description')
      .eq('lesson_id', params.lessonId)
      .maybeSingle(),
  ])

  if (lessonError || !lesson) notFound()

  const isAdmin = profile?.role === 'admin'
  const lessonIds = allLessons.map(l => l.id)

  // Batch 2: queries that depend on batch 1 results (course dates, lesson IDs, assignment ID).
  const courseFirstDay = course ? new Date(Date.UTC(course.year, course.month - 1, 1)).toISOString() : null
  const courseLastDay = course ? new Date(Date.UTC(course.year, course.month, 0, 23, 59, 59)).toISOString() : null

  const [
    { data: coveringSubscription },
    progressResult,
    submissionResult,
  ] = await Promise.all([
    courseFirstDay && courseLastDay
      ? supabase.from('subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .lte('current_period_start', courseLastDay)
          .gte('current_period_end', courseFirstDay)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    lessonIds.length > 0
      ? supabase.from('lesson_progress')
          .select('lesson_id, is_completed')
          .eq('user_id', user.id)
          .in('lesson_id', lessonIds)
          .eq('is_completed', true)
      : Promise.resolve({ data: [] }),
    assignment
      ? supabase.from('submissions')
          .select('id, text_content, file_url, status, grade, feedback')
          .eq('assignment_id', assignment.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const hasAccess = isAdmin || !!coursePurchase || !!coveringSubscription

  const submission = submissionResult.data

  const completedLessonIds = (progressResult.data ?? []).map(p => p.lesson_id)

  const canPlay = hasAccess && lesson.mux_status === 'ready' && lesson.mux_playback_id
  const [playbackToken, thumbnailToken] = canPlay
    ? await Promise.all([
        signPlaybackTokenForUser(lesson.mux_playback_id!, user.id),
        signThumbnailTokenForUser(lesson.mux_playback_id!, user.id),
      ])
    : [null, null]

  return (
    <LessonView
      courseId={params.courseId}
      lessonId={params.lessonId}
      lesson={{
        id: lesson.id,
        title: lesson.title,
        description: lesson.description ?? null,
        thumbnail_url: lesson.thumbnail_url ?? null,
        mux_playback_id: lesson.mux_playback_id ?? null,
        mux_status: lesson.mux_status ?? null,
      }}
      allLessons={allLessons}
      completedLessonIds={completedLessonIds}
      hasAccess={hasAccess}
      isAdmin={isAdmin}
      playbackToken={playbackToken}
      thumbnailToken={thumbnailToken}
      assignment={assignment ?? null}
      submission={submission ?? null}
      viewerUserId={user.id}
    />
  )
}
