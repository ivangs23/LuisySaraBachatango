import type { StudentDetail } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import styles from './StudentDetail.module.css'

export default function TabProgreso({ data }: { data: StudentDetail }) {
  if (data.lessonProgress.length === 0) return <p className={styles.dim}>Sin progreso registrado.</p>
  return (
    <ul className={styles.subList}>
      {data.lessonProgress.map(c => (
        <li key={c.course_id} className={styles.courseRow}>
          <strong>{c.course_title}</strong>
          <small className={styles.dim}>{c.completed} / {c.total} lecciones</small>
          <ul className={styles.lessonsList}>
            {c.lessons.map(l => (
              <li key={l.id} className={styles.lessonItem}>
                <span className={l.completed ? styles.lessonDone : styles.dim}>
                  {l.completed ? '✓' : '○'}
                </span>
                <span>{l.title}</span>
                {l.updated_at && <span className={styles.dim}>· {formatRelative(l.updated_at)}</span>}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
