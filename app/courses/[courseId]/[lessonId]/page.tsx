import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import styles from './lesson.module.css'

export default async function LessonPage(props: { params: Promise<{ courseId: string, lessonId: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch lesson details
  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', params.lessonId)
    .eq('course_id', params.courseId)
    .single()

  if (error || !lesson) {
    notFound()
  }

  // Check access rights
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing'])
    .single()

  const isAdmin = profile?.role === 'admin';
  const isPremium = profile?.role === 'premium';
  const hasActiveSubscription = !!subscription;
  const hasAccess = isAdmin || (isPremium && hasActiveSubscription) || hasActiveSubscription;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href={`/courses/${params.courseId}`} className={styles.backLink}>
          &larr; Volver al Curso
        </Link>
      </div>

      <div className={styles.videoWrapper}>
        {hasAccess ? (
          <iframe 
            src={lesson.video_url} 
            className={styles.videoPlayer} 
            allowFullScreen 
            title={lesson.title}
          />
        ) : (
          <div className={styles.lockedContent} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#1a1a1a', color: 'white', textAlign: 'center', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Contenido Bloqueado</h2>
            <p style={{ marginBottom: '1.5rem' }}>Este video es exclusivo para miembros Premium.</p>
            <Link href="/pricing" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
              Obtener Premium
            </Link>
          </div>
        )}
      </div>

      <div className={styles.content}>
        <h1 className={styles.title}>{lesson.title}</h1>
        
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${styles.tabActive}`}>Descripción</button>
          <button className={styles.tab}>Recursos Musicales</button>
          <button className={styles.tab}>Comentarios</button>
        </div>

        <div className={styles.description}>
          <p>{lesson.description}</p>
        </div>
      </div>
    </div>
  )
}
