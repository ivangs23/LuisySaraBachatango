'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { StudentRow, SortKey } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import styles from './StudentsTable.module.css'

const PLAN_LABEL: Record<string, string> = {
  '1month': 'Mensual', '6months': '6 meses', '1year': 'Anual',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' })
}

export default function StudentsTable({
  rows, sort,
}: { rows: StudentRow[]; sort: SortKey }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setSort(next: SortKey) {
    const sp = new URLSearchParams(params?.toString() ?? '')
    sp.set('sort', next)
    router.replace(`${pathname}?${sp.toString()}`)
  }

  function sortLabel(key: SortKey, label: string) {
    return (
      <button
        type="button"
        className={`${styles.sortBtn} ${sort === key ? styles.sortActive : ''}`}
        onClick={() => setSort(key)}
      >
        {label} {sort === key ? '↓' : ''}
      </button>
    )
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thAvatar}></th>
            <th>{sortLabel('name', 'Nombre')}</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Suscripción</th>
            <th>{sortLabel('created', 'Alta')}</th>
            <th>{sortLabel('recent', 'Última actividad')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} className={styles.empty}>No hay alumnos con esos filtros.</td></tr>
          )}
          {rows.map(r => (
            <tr
              key={r.id}
              onClick={() => router.push(`/admin/alumnos/${r.id}`)}
              className={styles.row}
            >
              <td className={styles.tdAvatar}>
                {r.avatar_url
                  ? <Image src={r.avatar_url} alt="" width={28} height={28} className={styles.avatar} />
                  : <span className={styles.avatarFallback} aria-hidden />}
              </td>
              <td className={styles.tdName}>
                <Link href={`/admin/alumnos/${r.id}`} onClick={e => e.stopPropagation()}>
                  {r.full_name ?? 'Sin nombre'}
                </Link>
              </td>
              <td className={styles.tdEmail}>{r.email ?? '—'}</td>
              <td><span className={`${styles.badge} ${styles[`role_${r.role}`]}`}>{r.role}</span></td>
              <td>
                {r.subPlan
                  ? <span className={styles.subActive}>✓ {PLAN_LABEL[r.subPlan] ?? r.subPlan}</span>
                  : <span className={styles.subNone}>—</span>}
              </td>
              <td>{formatDate(r.created_at)}</td>
              <td>{r.lastActivity ? formatRelative(r.lastActivity) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
