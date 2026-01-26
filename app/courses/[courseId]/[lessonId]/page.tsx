import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import styles from './lesson.module.css'
import LessonTabs from '@/components/LessonTabs'
import LessonVideoPlayer from '@/components/LessonVideoPlayer'

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

  let videoUrl = lesson.video_url;
  let isSupabaseVideo = false;

  if (videoUrl.startsWith('storage://')) {
    isSupabaseVideo = true;
    const path = videoUrl.replace('storage://', '');
    const { data } = await supabase.storage
      .from('course-content')
      .createSignedUrl(path, 3600); // 1 hour validity
    
    if (data?.signedUrl) {
      videoUrl = data.signedUrl;
    }
  }

  // Fetch all lessons for sidebar
  const { data: allLessons } = await supabase
    .from('lessons')
    .select('id, title, order')
    .eq('course_id', params.courseId)
    .order('order', { ascending: true })

  // Fetch all progress for this user in this course
  // We can fetch all progress entries for this user, or filter by lessons in this course.
  // Since we have allLessons, we can filter by their IDs if we want, or just fetch all for simplicity.
  // Let's fetch progress only for the relevant lessons.
  const lessonIds = allLessons?.map(l => l.id) || []
  
  let completedLessonIds = new Set<string>()

  if (lessonIds.length > 0) {
    const { data: progress } = await supabase
      .from('lesson_progress')
      .select('lesson_id, is_completed')
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
        <Link href={`/courses/${params.courseId}`} className={styles.backLink}>
          &larr; Volver al Curso
        </Link>
      </div>

      <div className={styles.mainLayout}>
        <aside className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>Lecciones del Curso</h3>
          <div className={styles.lessonList}>
            {allLessons?.map((l) => {
              const isCompleted = completedLessonIds.has(l.id)
              const isActive = l.id === params.lessonId
              
              return (
                <Link 
                  key={l.id} 
                  href={`/courses/${params.courseId}/${l.id}`}
                  className={`${styles.lessonItem} ${isActive ? styles.activeLesson : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <span className={styles.lessonOrder}>{l.order}.</span>
                    <span className={styles.lessonTitleText}>{l.title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isCompleted ? (
                       <span style={{ color: isActive ? 'white' : 'var(--primary)', fontSize: '1.2rem', fontWeight: 'bold' }}>✓</span>
                    ) : (
                       isActive && <span className={styles.playingIndicator}>▶</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </aside>

        <div className={styles.contentWrapper}>
          <div className={styles.videoWrapper}>
            {hasAccess ? (
              <LessonVideoPlayer 
                videoUrl={videoUrl}
                isSupabaseVideo={isSupabaseVideo}
                lessonId={params.lessonId}
                courseId={params.courseId}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 className={styles.title}>{lesson.title}</h1>
              {isAdmin && (
                <Link 
                  href={`/courses/${params.courseId}/${params.lessonId}/edit`} 
                  className={styles.adminButton}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--primary)', // or a different color for edit
                    color: 'white',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontSize: '0.9rem'
                  }}
                >
                  ✎ Editar Lección
                </Link>
              )}
            </div>
            
            <LessonTabs 
              description={lesson.description} 
              courseId={params.courseId} 
              lessonId={params.lessonId} 
            />
          </div>
        </div>
      </div>
    </div>
  )
}
