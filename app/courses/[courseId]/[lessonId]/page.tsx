import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import styles from './lesson.module.css'
import LessonTabs from '@/components/LessonTabs'

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href={`/courses/${params.courseId}`} className={styles.backLink}>
          &larr; Volver al Curso
        </Link>
      </div>

      <div className={styles.videoWrapper}>
        {hasAccess ? (
          isSupabaseVideo ? (
             <video 
               src={videoUrl} 
               className={styles.videoPlayer} 
               controls 
               controlsList="nodownload" // Optional: harder to download
             />
          ) : (
            <iframe 
              src={lesson.video_url} 
              className={styles.videoPlayer} 
              allowFullScreen 
              title={lesson.title}
            />
          )
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
  )
}
