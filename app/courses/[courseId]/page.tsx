import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server'
import { getCurrentUser } from '@/utils/supabase/get-user'
import { safeJsonLd } from '@/utils/jsonld'
import { notFound, redirect } from 'next/navigation'
import CourseDetailView from '@/components/CourseDetailView'

export async function generateMetadata(
  props: { params: Promise<{ courseId: string }> }
): Promise<Metadata> {
  const { courseId } = await props.params;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from('courses')
    .select('title, description, image_url')
    .eq('id', courseId)
    .single();

  if (!course) return { title: 'Curso' };

  return {
    title: course.title,
    description: course.description ?? `Curso de Bachatango: ${course.title}. Aprende con Luis y Sara.`,
    openGraph: {
      title: `${course.title} | Luis y Sara Bachatango`,
      description: course.description ?? `Curso de Bachatango: ${course.title}.`,
      url: `/courses/${courseId}`,
      images: course.image_url ? [{ url: course.image_url, alt: course.title }] : [],
    },
    alternates: { canonical: `/courses/${courseId}` },
  };
}

export default async function CourseDetailPage(props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params;

  const user = await getCurrentUser()
  const supabase = await createClient()

  if (!user) {
    redirect(`/login?message=Please login to view this course&next=/courses/${params.courseId}`)
  }

  // Batch 1: course metadata, lesson list, and user role — all independent.
  const [
    { data: course, error: courseError },
    { data: lessons, error: lessonsError },
    { data: profile },
  ] = await Promise.all([
    supabase.from('courses').select('*').eq('id', params.courseId).single(),
    supabase.from('lessons')
      .select('id, title, order, release_date, parent_lesson_id')
      .eq('course_id', params.courseId)
      .order('order', { ascending: true }),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (courseError || !course) notFound()
  if (lessonsError) console.error('Error fetching lessons:', lessonsError)

  const isAdmin = profile?.role === 'admin'
  const lessonIds = lessons?.map(l => l.id) ?? []

  const courseFirstDay = new Date(course.year, course.month - 1, 1).toISOString()
  const courseLastDay = new Date(course.year, course.month, 0, 23, 59, 59).toISOString()

  // Batch 2: access checks and progress — run in parallel now that we have course dates and lesson IDs.
  const [
    { data: coursePurchase },
    { data: coveringSubscription },
    progressResult,
  ] = await Promise.all([
    supabase.from('course_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', params.courseId)
      .maybeSingle(),
    supabase.from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .lte('current_period_start', courseLastDay)
      .gte('current_period_end', courseFirstDay)
      .maybeSingle(),
    lessonIds.length > 0
      ? supabase.from('lesson_progress')
          .select('lesson_id')
          .eq('user_id', user.id)
          .in('lesson_id', lessonIds)
          .eq('is_completed', true)
      : Promise.resolve({ data: [] }),
  ])

  const hasAccess = isAdmin || !!coursePurchase || !!coveringSubscription

  const completedLessonIds = (progressResult.data ?? []).map(p => p.lesson_id)

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://luisysarabachatango.com'
  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.description ?? `Curso de Bachatango con Luis y Sara.`,
    url: `${BASE_URL}/courses/${course.id}`,
    provider: {
      '@type': 'Organization',
      name: 'Luis y Sara Bachatango',
      url: BASE_URL,
    },
    ...(course.image_url ? { image: course.image_url } : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(courseJsonLd) }}
      />
      <CourseDetailView
        course={{
          id: course.id,
          title: course.title,
          description: course.description ?? null,
          image_url: course.image_url ?? null,
          month: course.month ?? null,
          year: course.year ?? null,
          course_type: course.course_type ?? 'complete',
          category: course.category ?? null,
          price_eur: course.price_eur ?? null,
        }}
        lessons={lessons ?? []}
        hasAccess={hasAccess}
        isAdmin={isAdmin}
        completedLessonIds={completedLessonIds}
      />
    </>
  )
}
