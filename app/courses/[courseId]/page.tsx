import SubscribeButton from '@/components/SubscribeButton';
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
  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', params.courseId)
    .order('order', { ascending: true })

  // Fetch user profile for role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Check subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .single()

  const isAdmin = profile?.role === 'admin';
  const isPremium = profile?.role === 'premium';
  const hasActiveSubscription = !!subscription;

  // Access logic: Admin OR (Premium AND Active Subscription)
  // Note: User requirement says "premium que ha pagado...". 
  // If role is 'premium', we assume they should have access, but let's enforce subscription check if that's the source of truth.
  // However, if 'premium' role is manually assigned, maybe they get access regardless? 
  // Let's stick to: Admin gets access. Premium gets access IF they have a subscription (or maybe just being 'premium' role is enough if that's how it's managed).
  // The prompt says: "premium que ha pagado la membresia y por tanto puede ver los cursos siempre y cuando halla sido premium ese mes."
  // This implies subscription check is key.
  
  const hasAccess = isAdmin || (isPremium && hasActiveSubscription) || hasActiveSubscription; // Fallback: if they have subscription, they probably should have access even if role isn't updated yet.

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/courses" className={styles.backLink}>&larr; Volver a Cursos</Link>
        <h1 className={styles.title}>{course.title}</h1>
        <p className={styles.description}>{course.description}</p>
        {isAdmin && (
          <Link href={`/courses/${course.id}/add-lesson`} className={styles.adminButton} style={{ display: 'inline-block', marginTop: '1rem', padding: '0.5rem 1rem', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
            + Añadir Lección
          </Link>
        )}
      </div>

      {!hasAccess ? (
        <div className={styles.lockedState}>
          <h2>Contenido Bloqueado</h2>
          <p>Necesitas una suscripción activa para ver este curso.</p>
          <div style={{ marginTop: '1rem' }}>
            <SubscribeButton />
          </div>
        </div>
      ) : (
        <div className={styles.lessonList}>
          {lessons && lessons.map((lesson) => (
            <Link href={`/courses/${course.id}/${lesson.id}`} key={lesson.id} className={styles.lessonCard}>
              <div className={styles.lessonNumber}>{lesson.order}</div>
              <div className={styles.lessonInfo}>
                <h3 className={styles.lessonTitle}>{lesson.title}</h3>
                <p className={styles.lessonDate}>
                  Disponible: {new Date(lesson.release_date).toLocaleDateString()}
                </p>
              </div>
              <div className={styles.playIcon}>▶</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
