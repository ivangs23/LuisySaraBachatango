import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CalendarDays, FileDown, Inbox, Paperclip, User } from 'lucide-react'
import GradeSubmissionForm from '@/components/GradeSubmissionForm'
import AdminShell, { AdminPanel } from '../../../_components/AdminShell'
import styles from './page.module.css'

export default async function SubmissionsPage(props: {
  params: Promise<{ courseId: string; lessonId: string }>
}) {
  const params = await props.params
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
    .select(
      'id, text_content, file_url, status, grade, feedback, created_at, updated_at, user_id, profiles(full_name, email, avatar_url)'
    )
    .eq('assignment_id', assignment.id)
    .order('created_at', { ascending: false })

  const total = submissions?.length ?? 0
  const reviewed = submissions?.filter((s) => s.status === 'reviewed').length ?? 0
  const pending = total - reviewed

  return (
    <AdminShell
      chapter="ADMIN · ENTREGAS"
      eyebrow="REVISAR · TAREAS"
      title={`Entregas · ${assignment.title}`}
      intro="Cada entrega se puede calificar con una nota y un feedback. El alumno recibirá una notificación cuando guardes la corrección."
      back={{
        href: `/courses/${params.courseId}/${params.lessonId}/edit`,
        label: 'Volver a editar lección',
      }}
      meta={[
        { icon: 'file', label: `${total} ${total === 1 ? 'entrega' : 'entregas'}` },
        { label: `${reviewed} corregidas` },
        { label: `${pending} pendientes` },
      ]}
    >
      <AdminPanel
        number="01"
        title="Bandeja de entregas"
        subtitle="Las entregas más recientes aparecen primero. Pulsa en cada bloque para añadir nota y feedback."
      >
        {!submissions || submissions.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <Inbox size={22} strokeWidth={1.6} />
            </span>
            <p className={styles.emptyTitle}>Aún no hay entregas para esta tarea.</p>
            <p className={styles.emptySub}>
              Cuando un alumno entregue su práctica, la verás aquí lista para
              corregir.
            </p>
          </div>
        ) : (
          <ul className={styles.list}>
            {submissions.map((sub) => {
              const studentProfile = (sub.profiles as unknown) as {
                full_name: string | null
                email: string | null
                avatar_url: string | null
              } | null
              const isReviewed = sub.status === 'reviewed'
              const fileName = sub.file_url ? sub.file_url.split('/').pop() : null
              return (
                <li
                  key={sub.id}
                  className={`${styles.card} ${
                    isReviewed ? styles.cardReviewed : ''
                  }`}
                >
                  <header className={styles.header}>
                    <div className={styles.student}>
                      <h3 className={styles.studentName}>
                        {studentProfile?.full_name ??
                          studentProfile?.email ??
                          'Alumno'}
                      </h3>
                      <span className={styles.studentMeta}>
                        <CalendarDays
                          size={12}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        Entregado el{' '}
                        {new Date(sub.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <span
                      className={`${styles.statusBadge} ${
                        isReviewed
                          ? styles.statusBadgeReviewed
                          : styles.statusBadgePending
                      }`}
                    >
                      <span className={styles.statusDot} aria-hidden="true" />
                      {isReviewed ? 'Corregida' : 'Pendiente'}
                    </span>
                  </header>

                  {sub.text_content && (
                    <div className={styles.fieldBlock}>
                      <p className={styles.fieldLabel}>
                        <span
                          className={styles.fieldLabelLine}
                          aria-hidden="true"
                        />
                        <User size={11} strokeWidth={2} aria-hidden="true" />
                        Respuesta del alumno
                      </p>
                      <p className={styles.fieldText}>{sub.text_content}</p>
                    </div>
                  )}

                  {sub.file_url && (
                    <div className={styles.fieldBlock}>
                      <p className={styles.fieldLabel}>
                        <span
                          className={styles.fieldLabelLine}
                          aria-hidden="true"
                        />
                        <Paperclip
                          size={11}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        Archivo adjunto
                      </p>
                      <a
                        href={sub.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.fieldFileRow}
                      >
                        <FileDown size={14} strokeWidth={2} aria-hidden="true" />
                        {fileName}
                      </a>
                    </div>
                  )}

                  {isReviewed && (
                    <div className={styles.reviewedPane}>
                      <p className={styles.reviewedHeader}>Corrección publicada</p>
                      {sub.grade && (
                        <p className={styles.reviewedGrade}>
                          Calificación: <strong>{sub.grade}</strong>
                        </p>
                      )}
                      {sub.feedback && (
                        <p className={styles.reviewedFeedback}>{sub.feedback}</p>
                      )}
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
                </li>
              )
            })}
          </ul>
        )}
      </AdminPanel>
    </AdminShell>
  )
}
