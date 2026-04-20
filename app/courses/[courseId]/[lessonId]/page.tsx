import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import styles from './lesson.module.css'
import LessonTabs from '@/components/LessonTabs'
import LessonVideoPlayer from '@/components/LessonVideoPlayer'
import { getDict } from '@/utils/get-dict'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const t = await getDict();

  // Create Admin Client for Storage Operations (Bypass RLS)
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Batch 1: all queries that only need lessonId / courseId / userId.
  const [
    { data: lesson, error: lessonError },
    { data: profile },
    { data: course },
    { data: coursePurchase },
    { data: allLessons },
    { data: assignment },
  ] = await Promise.all([
    supabase.from('lessons')
      .select('id, title, description, video_url, video_source, media_config, course_id')
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
    supabase.from('lessons')
      .select('id, title, order')
      .eq('course_id', params.courseId)
      .order('order', { ascending: true }),
    supabase.from('assignments')
      .select('id, title, description')
      .eq('lesson_id', params.lessonId)
      .maybeSingle(),
  ])

  if (lessonError || !lesson) notFound()

  const isAdmin = profile?.role === 'admin'
  const lessonIds = allLessons?.map(l => l.id) ?? []

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

  const completedLessonIds = new Set<string>()
  progressResult.data?.forEach(p => completedLessonIds.add(p.lesson_id))

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href={`/courses/${params.courseId}`} className={styles.backLink}>
          {t.lesson.backToCourse}
        </Link>
      </div>

      <div className={styles.mainLayout}>
        <aside className={styles.sidebar}>
          <h3 className={styles.sidebarTitle}>{t.lesson.courseLessons}</h3>
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
                <h2 style={{ marginBottom: '1rem' }}>{t.lesson.lockedContent}</h2>
                <p style={{ marginBottom: '1.5rem' }}>{t.lesson.lockedMessage}</p>
                <Link href="/pricing" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
                  {t.lesson.getPremium}
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
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontSize: '0.9rem'
                  }}
                >
                  {t.lesson.editLesson}
                </Link>
              )}
            </div>

            {hasAccess ? (
              <LessonTabs
                description={lesson.description}
                courseId={params.courseId}
                lessonId={params.lessonId}
                assignment={assignment}
                submission={submission}
                isAdmin={isAdmin}
              />
            ) : (
              <div style={{ marginTop: '2rem', padding: '2rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>{t.lesson.exclusiveContent}</p>
                <Link href="/pricing" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>
                  {t.lesson.getPremium}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
