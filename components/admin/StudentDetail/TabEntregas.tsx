import Link from 'next/link'
import type { StudentDetail } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import styles from './StudentDetail.module.css'

export default function TabEntregas({ data }: { data: StudentDetail }) {
  if (data.submissions.length === 0) return <p className={styles.dim}>Sin entregas.</p>
  return (
    <table className={styles.subItemTable}>
      <thead>
        <tr><th>Tarea</th><th>Curso · Lección</th><th>Estado</th><th>Nota</th><th>Enviada</th><th></th></tr>
      </thead>
      <tbody>
        {data.submissions.map(s => (
          <tr key={s.id}>
            <td>{s.assignment_title}</td>
            <td>{s.course_title} · {s.lesson_title}</td>
            <td>
              <span className={s.status === 'pending' ? styles.statusPending : styles.statusReviewed}>
                {s.status === 'pending' ? 'Pendiente' : 'Revisada'}
              </span>
            </td>
            <td>{s.grade ?? '—'}</td>
            <td>{formatRelative(s.created_at)}</td>
            <td>
              <Link href={`/courses/${s.course_id}/${s.lesson_id}/submissions`} className={styles.link}>
                Abrir →
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
