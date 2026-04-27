import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import LessonForm from '@/components/LessonForm'
import { createLesson } from '@/app/courses/actions'
import AdminShell, { AdminPanel } from '../../_components/AdminShell'

export default async function AddLessonPage(props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect(`/courses/${params.courseId}`)

  const [{ data: course }, { data: topLevelLessons }] = await Promise.all([
    supabase.from('courses').select('id, title').eq('id', params.courseId).single(),
    supabase
      .from('lessons')
      .select('id, title, "order"')
      .eq('course_id', params.courseId)
      .is('parent_lesson_id', null)
      .order('order', { ascending: true }),
  ])

  if (!course) notFound()

  const total = topLevelLessons?.length ?? 0

  return (
    <AdminShell
      chapter="ADMIN · LECCIONES"
      eyebrow="NUEVA · LECCIÓN"
      title="Añadir Nueva Lección"
      intro={`Vas a añadir una lección al curso "${course.title}". Define el orden, la jerarquía y el material; el vídeo y las tareas se configuran después.`}
      back={{ href: `/courses/${params.courseId}`, label: 'Volver al curso' }}
      meta={[
        { icon: 'file', label: `${total} ${total === 1 ? 'lección' : 'lecciones'} previas` },
      ]}
      narrow
    >
      <AdminPanel
        number="01"
        title="Datos de la lección"
        subtitle="Lo esencial para que aparezca en el índice del curso."
      >
        <LessonForm
          courseId={params.courseId}
          availableParents={topLevelLessons ?? []}
          action={createLesson}
        />
      </AdminPanel>
    </AdminShell>
  )
}
