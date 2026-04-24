import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import LessonForm from '@/components/LessonForm'
import { createLesson } from '@/app/courses/actions'

export default async function AddLessonPage(props: { params: Promise<{ courseId: string }> }) {
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

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Añadir Nueva Lección</h1>
      <LessonForm courseId={params.courseId} action={createLesson} />
    </div>
  )
}
