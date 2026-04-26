import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import LessonForm from '@/components/LessonForm'
import VideoUploadWidget from '@/components/VideoUploadWidget'
import MuxTracksManager from '@/components/MuxTracksManager'
import AssignmentManager from '@/components/AssignmentManager'
import { listMuxTracks } from '@/utils/mux/tracks'
import { updateLesson } from '@/app/courses/actions'
import AdminShell, { AdminPanel } from '../../../_components/AdminShell'

export default async function EditLessonPage(props: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const params = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect(`/courses/${params.courseId}`)

  const [{ data: lesson }, { data: topLevelLessons }, { data: assignment }] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, title, description, "order", thumbnail_url, duration, is_free, mux_asset_id, mux_playback_id, mux_status, parent_lesson_id')
      .eq('id', params.lessonId)
      .eq('course_id', params.courseId)
      .single(),
    supabase
      .from('lessons')
      .select('id, title, "order"')
      .eq('course_id', params.courseId)
      .is('parent_lesson_id', null)
      .neq('id', params.lessonId)
      .order('order', { ascending: true }),
    supabase
      .from('assignments')
      .select('id, title, description')
      .eq('lesson_id', params.lessonId)
      .maybeSingle(),
  ])

  if (!lesson) notFound()

  const tracks = lesson.mux_asset_id ? await listMuxTracks(lesson.mux_asset_id) : []
  const muxStatus = (lesson.mux_status ?? 'pending_upload') as
    | 'pending_upload'
    | 'preparing'
    | 'ready'
    | 'errored'

  const statusLabel: Record<typeof muxStatus, string> = {
    pending_upload: 'SIN VÍDEO',
    preparing: 'PROCESANDO',
    ready: 'PUBLICADO',
    errored: 'ERROR',
  }

  return (
    <AdminShell
      chapter="ADMIN · LECCIÓN"
      eyebrow="EDITAR · LECCIÓN"
      title={`Editar ${lesson.title ?? 'Lección'}`}
      intro="Edita los datos, sube o reemplaza el vídeo, gestiona pistas y tareas asociadas. Cada bloque se guarda de forma independiente."
      back={{ href: `/courses/${params.courseId}/${params.lessonId}`, label: 'Volver a la lección' }}
      meta={[
        { icon: 'file', label: `Vídeo: ${statusLabel[muxStatus]}` },
        { label: lesson.is_free ? 'GRATUITA' : 'PREMIUM' },
      ]}
    >
      <AdminPanel
        number="01"
        title="Información de la lección"
        subtitle="Título, descripción, posición en el índice y jerarquía."
      >
        <LessonForm
          courseId={params.courseId}
          initialData={lesson}
          availableParents={topLevelLessons ?? []}
          action={updateLesson}
        />
      </AdminPanel>

      <AdminPanel
        number="02"
        title="Vídeo de la lección"
        subtitle="Sube el archivo a Mux. El vídeo se procesa en segundo plano y el reproductor se activa cuando esté listo."
      >
        <VideoUploadWidget
          lessonId={lesson.id}
          currentStatus={muxStatus}
          currentPlaybackId={lesson.mux_playback_id}
        />
      </AdminPanel>

      {lesson.mux_status === 'ready' && lesson.mux_asset_id && (
        <AdminPanel
          number="03"
          title="Subtítulos y pistas"
          subtitle="Añade pistas de subtítulos generadas o subidas. Los alumnos podrán activarlas desde el reproductor."
        >
          <MuxTracksManager lessonId={lesson.id} tracks={tracks} />
        </AdminPanel>
      )}

      <AdminPanel
        number={lesson.mux_status === 'ready' && lesson.mux_asset_id ? '04' : '03'}
        title="Tarea asociada"
        subtitle="Crea una tarea opcional para que los alumnos entreguen práctica al terminar esta lección."
      >
        <AssignmentManager
          lessonId={params.lessonId}
          courseId={params.courseId}
          assignment={assignment ?? null}
        />
      </AdminPanel>
    </AdminShell>
  )
}
