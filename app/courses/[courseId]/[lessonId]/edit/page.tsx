import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import LessonForm from '@/components/LessonForm'
import AssignmentManager from '@/components/AssignmentManager'

export default async function EditLessonPage(props: { params: Promise<{ courseId: string, lessonId: string }> }) {
  const params = await props.params;
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect(`/courses/${params.courseId}`)
  }

  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', params.lessonId)
    .single()

  if (error || !lesson) {
    notFound()
  }

  // Fetch existing assignment for this lesson (if any)
  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, title, description')
    .eq('lesson_id', params.lessonId)
    .maybeSingle()

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Editar Lección: {lesson.title}</h1>
      <LessonForm courseId={params.courseId} initialData={lesson} />
      <AssignmentManager
        lessonId={params.lessonId}
        courseId={params.courseId}
        assignment={assignment ?? null}
      />
    </div>
  )
}
