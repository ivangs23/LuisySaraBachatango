import type { Metadata } from 'next';
import BuyCourseButton from '@/components/BuyCourseButton';
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import styles from './course-detail.module.css'

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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  const completedLessonIds = new Set<string>()
  progressResult.data?.forEach(p => completedLessonIds.add(p.lesson_id))

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/courses" className={styles.backLink}>&larr; Volver a Cursos</Link>
        <h1 className={styles.title}>{course.title}</h1>
        <p className={styles.description}>{course.description}</p>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <Link href={`/courses/${course.id}/edit`} className={styles.adminButton} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--text-secondary)', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
              Editar Curso
            </Link>
            <Link href={`/courses/${course.id}/add-lesson`} className={styles.adminButton} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
              + Añadir Lección
            </Link>
          </div>
        )}
      </div>

      {!hasAccess ? (
        <div className={styles.lockedState}>
          <h2>Contenido Bloqueado</h2>
          <p>Compra este curso o suscríbete para acceder a las lecciones.</p>
          <div style={{ marginTop: '1rem' }}>
            <BuyCourseButton courseId={params.courseId} label="Comprar este curso" />
          </div>
        </div>
      ) : (
        <div className={styles.lessonList}>
          {lessons && (() => {
            const parents = lessons.filter(l => !l.parent_lesson_id).sort((a, b) => a.order - b.order)
            const childrenByParent = new Map<string, typeof lessons>()
            lessons.filter(l => l.parent_lesson_id).forEach(l => {
              const key = l.parent_lesson_id!
              if (!childrenByParent.has(key)) childrenByParent.set(key, [])
              childrenByParent.get(key)!.push(l)
            })

            const items: { lesson: typeof lessons[0]; displayOrder: string; isChild: boolean }[] = []
            for (const parent of parents) {
              items.push({ lesson: parent, displayOrder: `${parent.order}`, isChild: false })
              const children = (childrenByParent.get(parent.id) ?? []).sort((a, b) => a.order - b.order)
              for (const child of children) {
                items.push({ lesson: child, displayOrder: `${parent.order}.${child.order}`, isChild: true })
              }
            }

            return items.map(({ lesson, displayOrder, isChild }) => {
              const isCompleted = completedLessonIds.has(lesson.id)
              return (
                <Link
                  href={`/courses/${course.id}/${lesson.id}`}
                  key={lesson.id}
                  className={styles.lessonCard}
                  style={isChild ? { paddingLeft: '2.5rem' } : undefined}
                >
                  <div className={styles.lessonNumber}>{displayOrder}</div>
                  <div className={styles.lessonInfo}>
                    <h3 className={styles.lessonTitle}>{lesson.title}</h3>
                    <p className={styles.lessonDate}>
                      Disponible: {new Date(lesson.release_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={styles.playIcon}>
                    {isCompleted ? (
                      <span style={{ color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold' }}>✓</span>
                    ) : (
                      '▶'
                    )}
                  </div>
                </Link>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}
