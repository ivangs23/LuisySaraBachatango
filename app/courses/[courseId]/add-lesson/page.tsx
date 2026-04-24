import LessonForm from '@/components/LessonForm'
import { createLesson } from '@/app/courses/actions'

export default async function AddLessonPage(props: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await props.params
  return (
    <div style={{ padding: '2rem 10%', maxWidth: 800, margin: '0 auto' }}>
      <h1>Añadir Lección</h1>
      <LessonForm courseId={courseId} action={createLesson} />
    </div>
  )
}
