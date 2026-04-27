import Link from 'next/link'
import { centsToEur } from '@/utils/admin/metrics'
import type { StudentDetail } from '@/utils/admin/queries'
import styles from './StudentDetail.module.css'

export default function TabCursos({ data }: { data: StudentDetail }) {
  const purchaseProgress = (courseId: string) =>
    data.lessonProgress.find(p => p.course_id === courseId)

  return (
    <div className={styles.subList}>
      <h3 className={styles.summaryBlockHeading}>Por compra</h3>
      {data.purchases.length === 0 && <p className={styles.dim}>Sin compras.</p>}
      <ul className={styles.subList}>
        {data.purchases.map(p => {
          const prog = purchaseProgress(p.course_id)
          const pct = prog && prog.total ? Math.round((prog.completed / prog.total) * 100) : 0
          return (
            <li key={p.id} className={styles.courseRow}>
              <Link href={`/courses/${p.course_id}`}>{p.course_title}</Link>
              <small className={styles.dim}>
                €{centsToEur(p.amount_paid).toFixed(0)} · {new Date(p.created_at).toLocaleDateString('es-ES')}
              </small>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
              <small>{pct}% completado</small>
            </li>
          )
        })}
      </ul>

      <h3 className={styles.summaryBlockHeading}>Por suscripción</h3>
      {data.membershipCourses.length === 0 && <p className={styles.dim}>Sin acceso por suscripción.</p>}
      <ul className={styles.subList}>
        {data.membershipCourses.map(c => {
          const prog = purchaseProgress(c.id)
          const pct = prog && prog.total ? Math.round((prog.completed / prog.total) * 100) : 0
          return (
            <li key={c.id} className={styles.courseRow}>
              <Link href={`/courses/${c.id}`}>{c.title}</Link>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${pct}%` }} />
              </div>
              <small>{pct}% completado</small>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
