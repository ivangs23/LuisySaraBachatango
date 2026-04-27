import {
  Users, UserPlus, Sparkles, GraduationCap, BookOpen, Inbox,
} from 'lucide-react'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import { getOverviewKpis } from '@/utils/admin/queries'
import { pctChange } from '@/utils/admin/metrics'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  const k = await getOverviewKpis()
  const change = pctChange(k.prevMonthRevenueEur, k.monthRevenueEur)
  const arrow = change === null ? '' : change > 0 ? '↑' : change < 0 ? '↓' : ''
  const trend: 'up' | 'down' | null =
    change === null ? null : change > 0 ? 'up' : change < 0 ? 'down' : null

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>PANEL · ADMIN</span>
        <h1 className={styles.title}>Centro de control</h1>
        <p className={styles.sub}>
          Estado actual del negocio, alumnos y entregas.
        </p>
      </header>

      <section className={styles.kpiGrid} aria-label="Métricas principales">
        <AdminKpiCard
          Icon={Users}
          label="Alumnos totales"
          value={String(k.totalStudents)}
          sub={`+${k.newThisWeek} esta semana`}
        />
        <AdminKpiCard
          Icon={Sparkles}
          label="Suscripciones activas"
          value={String(k.activeSubs)}
          sub={`MRR ~ €${k.mrrEur.toFixed(0)}/mes`}
        />
        <AdminKpiCard
          Icon={Sparkles}
          label="Ingresos del mes"
          value={`€${k.monthRevenueEur.toFixed(0)}`}
          sub={
            change === null
              ? `vs €${k.prevMonthRevenueEur.toFixed(0)} mes ant.`
              : `vs €${k.prevMonthRevenueEur.toFixed(0)} ${arrow}${Math.abs(change)}%`
          }
          trend={trend}
        />
        <AdminKpiCard
          Icon={GraduationCap}
          label="Cursos publicados"
          value={String(k.publishedCourses)}
          sub={`${k.totalLessons} lecciones`}
        />
        <AdminKpiCard
          Icon={Inbox}
          label="Entregas pendientes"
          value={String(k.pendingSubmissions)}
          sub={
            k.oldestPendingDays != null
              ? `Más antigua: hace ${k.oldestPendingDays}d`
              : 'Sin pendientes'
          }
        />
        <AdminKpiCard
          Icon={UserPlus}
          label="Nuevos esta semana"
          value={String(k.newThisWeek)}
          sub={`+${k.newToday} hoy`}
        />
      </section>
    </div>
  )
}
