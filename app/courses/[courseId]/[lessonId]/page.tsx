import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
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

  // Create Admin Client for Storage Operations (Bypass RLS)
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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

  const isAdmin = profile?.role === 'admin';

  // Fetch the course to get month/year for subscription coverage check
  const { data: course } = await supabase
    .from('courses')
    .select('month, year')
    .eq('id', params.courseId)
    .single()

  // 1. Individual course purchase
  const { data: coursePurchase } = await supabase
    .from('course_purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', params.courseId)
    .maybeSingle()

  // 2. Active subscription covering this course's month/year
  let coveringSubscription = null;
  if (course) {
    const courseFirstDay = new Date(Date.UTC(course.year, course.month - 1, 1)).toISOString()
    const courseLastDay = new Date(Date.UTC(course.year, course.month, 0, 23, 59, 59)).toISOString()

    const { data } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .lte('current_period_start', courseLastDay)
      .gte('current_period_end', courseFirstDay)
      .maybeSingle()

    coveringSubscription = data;
  }

  const hasAccess = isAdmin || !!coursePurchase || !!coveringSubscription;

  let videoUrl = lesson.video_url;
  let isSupabaseVideo = false;

  // Route storage videos through the proxy — access is re-validated on every request
  // and the proxy issues a short-lived (300 s) signed URL redirect.
  if (videoUrl.startsWith('storage://')) {
    isSupabaseVideo = true;
    videoUrl = `/api/video/${params.lessonId}?courseId=${params.courseId}`;
  }

  // Sign audio tracks and subtitle URLs in parallel — 5-minute expiry
  type TrackItem = { language: string; label: string; url: string }
  let mediaConfig = lesson.media_config ? JSON.parse(JSON.stringify(lesson.media_config)) : null;

  if (mediaConfig) {
    const signUrl = async (item: TrackItem) => {
      if (!item.url?.startsWith('storage://')) return item;
      const path = item.url.replace('storage://', '');
      const { data, error } = await supabaseAdmin.storage.from('course-content').createSignedUrl(path, 300);
      if (error || !data?.signedUrl) return null;
      return { ...item, url: data.signedUrl };
    };

    const [signedTracks, signedSubtitles] = await Promise.all([
      Promise.all((mediaConfig.tracks ?? []).map(signUrl)),
      Promise.all((mediaConfig.subtitles ?? []).map(signUrl)),
    ]);

    mediaConfig.tracks = signedTracks.filter(Boolean);
    mediaConfig.subtitles = signedSubtitles.filter(Boolean);
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

  // Fetch assignment for this lesson (if any)
  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, title, description')
    .eq('lesson_id', params.lessonId)
    .maybeSingle()

  // Fetch user's submission for this assignment
  let submission = null;
  if (assignment) {
    const { data } = await supabase
      .from('submissions')
      .select('id, text_content, file_url, status, grade, feedback')
      .eq('assignment_id', assignment.id)
      .eq('user_id', user.id)
      .maybeSingle()
    submission = data;
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
                mediaConfig={mediaConfig}
                videoSource={lesson.video_source} // Pass explicit source type
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
              assignment={assignment}
              submission={submission}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
