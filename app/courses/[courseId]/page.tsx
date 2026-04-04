import BuyCourseButton from '@/components/BuyCourseButton';
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import styles from './course-detail.module.css'

export default async function CourseDetailPage(props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params;

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?message=Please login to view this course&next=/courses/${params.courseId}`)
  }

  // Fetch course details
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', params.courseId)
    .single()

  if (courseError || !course) {
    notFound()
  }

  // Fetch lessons
  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', params.courseId)
    .order('order', { ascending: true })

  if (lessonsError) {
    console.error('Error fetching lessons:', lessonsError)
  }

  // Fetch user profile for role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin';

  // --- Access check ---
  // 1. Individual course purchase
  const { data: coursePurchase } = await supabase
    .from('course_purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', params.courseId)
    .maybeSingle()

  // 2. Active subscription covering this course's month/year
  //    A subscription covers a course if current_period_start <= last day of course month
  //    AND current_period_end >= first day of course month
  const courseFirstDay = new Date(course.year, course.month - 1, 1).toISOString()
  const courseLastDay = new Date(course.year, course.month, 0, 23, 59, 59).toISOString()

  const { data: coveringSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .lte('current_period_start', courseLastDay)
    .gte('current_period_end', courseFirstDay)
    .maybeSingle()

  const hasAccess = isAdmin || !!coursePurchase || !!coveringSubscription;

  // Fetch lesson progress
  const lessonIds = lessons?.map(l => l.id) || []
  const completedLessonIds = new Set<string>()

  if (lessonIds.length > 0) {
    const { data: progress } = await supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', user.id)
      .in('lesson_id', lessonIds)
      .eq('is_completed', true)

    if (progress) {
      progress.forEach(p => completedLessonIds.add(p.lesson_id))
    }
  }

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
          {lessons && lessons.map((lesson) => {
            const isCompleted = completedLessonIds.has(lesson.id)
            return (
              <Link href={`/courses/${course.id}/${lesson.id}`} key={lesson.id} className={styles.lessonCard}>
                <div className={styles.lessonNumber}>{lesson.order}</div>
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
          })}
        </div>
      )}
    </div>
  )
}
