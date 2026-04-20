import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import GradeSubmissionForm from '@/components/GradeSubmissionForm'

export default async function SubmissionsPage(props: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
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
    redirect(`/courses/${params.courseId}/${params.lessonId}`)
  }

  // Fetch the assignment for this lesson
  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, title, description')
    .eq('lesson_id', params.lessonId)
    .maybeSingle()

  if (!assignment) {
    notFound()
  }

  // Fetch all submissions with profile info
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, text_content, file_url, status, grade, feedback, created_at, updated_at, user_id, profiles(full_name, email, avatar_url)')
    .eq('assignment_id', assignment.id)
    .order('created_at', { ascending: false })

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <Link
          href={`/courses/${params.courseId}/${params.lessonId}/edit`}
          style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}
        >
          &larr; Volver a Editar Lección
        </Link>
      </div>

      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
        Entregas: {assignment.title}
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        {submissions?.length ?? 0} entrega(s) recibida(s)
      </p>

      {!submissions || submissions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Aún no hay entregas para esta tarea.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {submissions.map((sub) => {
            const studentProfile = (sub.profiles as unknown) as { full_name: string | null; email: string | null; avatar_url: string | null } | null;
            return (
              <div
                key={sub.id}
                style={{
                  background: '#1a1a1a',
                  border: `1px solid ${sub.status === 'reviewed' ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '10px',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-main)' }}>
                      {studentProfile?.full_name ?? studentProfile?.email ?? 'Alumno'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Entregado: {new Date(sub.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span style={{
                    padding: '0.2rem 0.7rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: sub.status === 'reviewed' ? 'rgba(76,175,80,0.15)' : 'rgba(255,165,0,0.15)',
                    color: sub.status === 'reviewed' ? '#4CAF50' : 'orange',
                    border: `1px solid ${sub.status === 'reviewed' ? 'rgba(76,175,80,0.3)' : 'rgba(255,165,0,0.3)'}`,
                  }}>
                    {sub.status === 'reviewed' ? 'Corregida' : 'Pendiente'}
                  </span>
                </div>

                {sub.text_content && (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Respuesta:</p>
                    <p style={{ color: 'var(--text-main)', whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.6 }}>{sub.text_content}</p>
                  </div>
                )}

                {sub.file_url && (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Archivo adjunto:</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{sub.file_url.split('/').pop()}</p>
                  </div>
                )}

                {sub.status === 'reviewed' && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(76,175,80,0.06)', borderRadius: '6px' }}>
                    {sub.grade && <p style={{ margin: '0 0 0.25rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>Calificación: <strong>{sub.grade}</strong></p>}
                    {sub.feedback && <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{sub.feedback}</p>}
                  </div>
                )}

                <GradeSubmissionForm
                  submissionId={sub.id}
                  submittedUserId={sub.user_id}
                  courseId={params.courseId}
                  lessonId={params.lessonId}
                  currentGrade={sub.grade}
                  currentFeedback={sub.feedback}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
