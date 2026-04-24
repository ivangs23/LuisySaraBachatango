import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import LessonForm from '@/components/LessonForm'
import VideoUploadWidget from '@/components/VideoUploadWidget'
import MuxTracksManager from '@/components/MuxTracksManager'
import AssignmentManager from '@/components/AssignmentManager'
import { listMuxTracks } from '@/utils/mux/tracks'
import { updateLesson } from '@/app/courses/actions'

export default async function EditLessonPage(props: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const params = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect(`/courses/${params.courseId}`)

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, title, description, "order", thumbnail_url, duration, is_free, mux_asset_id, mux_playback_id, mux_status')
    .eq('id', params.lessonId)
    .eq('course_id', params.courseId)
    .single()

  if (!lesson) notFound()

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, title, description')
    .eq('lesson_id', params.lessonId)
    .maybeSingle()

  const tracks = lesson.mux_asset_id ? await listMuxTracks(lesson.mux_asset_id) : []

  return (
    <div style={{ padding: '2rem 10%', maxWidth: 1000, margin: '0 auto' }}>
      <h1>Editar Lección</h1>

      <LessonForm courseId={params.courseId} initialData={lesson} action={updateLesson} />

      <VideoUploadWidget
        lessonId={lesson.id}
        currentStatus={(lesson.mux_status ?? 'pending_upload') as 'pending_upload' | 'preparing' | 'ready' | 'errored'}
        currentPlaybackId={lesson.mux_playback_id}
      />

      {lesson.mux_status === 'ready' && lesson.mux_asset_id && (
        <MuxTracksManager lessonId={lesson.id} tracks={tracks} />
      )}

      <AssignmentManager
        lessonId={params.lessonId}
        courseId={params.courseId}
        assignment={assignment ?? null}
      />
    </div>
  )
}
