import {
  Users, UserPlus, Sparkles, GraduationCap, BookOpen, Inbox,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import AdminKpiCard from '@/components/admin/AdminKpiCard'
import {
  getOverviewKpis, getLatestStudents, getRecentPayments, getActiveCourses,
} from '@/utils/admin/queries'
import { pctChange, formatRelative } from '@/utils/admin/metrics'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  const [k, latestStudents, recentPayments, activeCourses] = await Promise.all([
    getOverviewKpis(),
    getLatestStudents(),
    getRecentPayments(),
    getActiveCourses(),
  ])

  const change = pctChange(k.prevMonthRevenueEur, k.monthRevenueEur)
  const arrow = change === null ? '' : change > 0 ? '↑' : change < 0 ? '↓' : ''
  const trend: 'up' | 'down' | null =
    change === null ? null : change > 0 ? 'up' : change < 0 ? 'down' : null

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>PANEL · ADMIN</span>
        <h1 className={styles.title}>Centro de control</h1>
        <p className={styles.sub}>Estado actual del negocio, alumnos y entregas.</p>
      </header>

      <section className={styles.kpiGrid} aria-label="Métricas principales">
        <AdminKpiCard Icon={Users} label="Alumnos totales" value={String(k.totalStudents)} sub={`+${k.newThisWeek} esta semana`} />
        <AdminKpiCard Icon={Sparkles} label="Suscripciones activas" value={String(k.activeSubs)} sub={`MRR ~ €${k.mrrEur.toFixed(0)}/mes`} />
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
        <AdminKpiCard Icon={GraduationCap} label="Cursos publicados" value={String(k.publishedCourses)} sub={`${k.totalLessons} lecciones`} />
        <AdminKpiCard
          Icon={Inbox}
          label="Entregas pendientes"
          value={String(k.pendingSubmissions)}
          sub={k.oldestPendingDays != null ? `Más antigua: hace ${k.oldestPendingDays}d` : 'Sin pendientes'}
        />
        <AdminKpiCard Icon={UserPlus} label="Nuevos esta semana" value={String(k.newThisWeek)} sub={`+${k.newToday} hoy`} />
      </section>

      <section className={styles.lists}>
        {/* Latest students */}
        <div className={styles.listCard}>
          <header className={styles.listHeader}>
            <h2>Últimos alumnos</h2>
            <Link href="/admin/alumnos" className={styles.listLink}>Ver todos →</Link>
          </header>
          <ul className={styles.listBody}>
            {latestStudents.length === 0 && <li className={styles.empty}>Sin alumnos.</li>}
            {latestStudents.map(s => (
              <li key={s.id} className={styles.listRow}>
                <Link href={`/admin/alumnos/${s.id}`} className={styles.listRowLink}>
                  {s.avatar_url ? (
                    <Image src={s.avatar_url} alt="" width={28} height={28} className={styles.avatar} />
                  ) : (
                    <span className={styles.avatarFallback} aria-hidden />
                  )}
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{s.full_name ?? 'Sin nombre'}</span>
                    <span className={styles.rowMeta}>{s.email}</span>
                  </span>
                  <span className={styles.rowAside}>{formatRelative(s.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent payments */}
        <div className={styles.listCard}>
          <header className={styles.listHeader}>
            <h2>Compras y suscripciones</h2>
          </header>
          <ul className={styles.listBody}>
            {recentPayments.length === 0 && <li className={styles.empty}>Sin movimientos.</li>}
            {recentPayments.map((p, i) => (
              <li key={`${p.kind}-${i}`} className={styles.listRow}>
                <span className={styles.rowMain}>
                  <span className={styles.rowName}>{p.userName ?? 'Anónimo'}</span>
                  <span className={styles.rowMeta}>
                    {p.kind === 'purchase'
                      ? `compró ${p.courseTitle}`
                      : `se suscribió (${p.planType ?? '—'})`}
                  </span>
                </span>
                <span className={styles.rowAside}>
                  {p.kind === 'purchase' ? `€${p.amountEur.toFixed(0)} · ` : ''}
                  {formatRelative(p.date)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Active courses */}
        <div className={styles.listCard}>
          <header className={styles.listHeader}>
            <h2>Cursos más activos</h2>
            <Link href="/admin/cursos" className={styles.listLink}>Ver todos →</Link>
          </header>
          <ul className={styles.listBody}>
            {activeCourses.length === 0 && <li className={styles.empty}>Sin actividad reciente.</li>}
            {activeCourses.map(c => (
              <li key={c.id} className={styles.listRow}>
                <Link href={`/courses/${c.id}`} className={styles.listRowLink}>
                  {c.image_url ? (
                    <Image src={c.image_url} alt="" width={32} height={32} className={styles.thumb} />
                  ) : (
                    <span className={styles.thumbFallback} aria-hidden><BookOpen size={14} /></span>
                  )}
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{c.title}</span>
                    <span className={styles.rowMeta}>{c.completedCount} lecciones completadas (30d)</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.actions} aria-label="Accesos rápidos">
        <Link href="/courses/create" className={styles.actionBtn}>
          <span className={styles.actionPlus}>+</span> Crear curso
        </Link>
        <Link href="/admin/cursos" className={styles.actionBtn}>
          <span className={styles.actionPlus}>+</span> Crear lección
        </Link>
        <Link href="/admin/alumnos" className={styles.actionBtn}>
          <ArrowRight size={14} aria-hidden /> Ver alumnos
        </Link>
        <Link href="/admin/entregas" className={styles.actionBtn}>
          <ArrowRight size={14} aria-hidden /> Entregas pendientes
          {k.pendingSubmissions > 0 ? <span className={styles.actionBadge}>{k.pendingSubmissions}</span> : null}
        </Link>
      </section>
    </div>
  )
}
