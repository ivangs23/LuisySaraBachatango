import Link from 'next/link'
import { listSubmissions } from '@/utils/admin/queries'
import { formatRelative } from '@/utils/admin/metrics'
import styles from '@/app/admin/alumnos/alumnos.module.css'

export const dynamic = 'force-dynamic'

export default async function EntregasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const sp = await searchParams
  const tab = sp.tab === 'reviewed' ? 'reviewed' : 'pending'
  const rows = await listSubmissions(tab)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Entregas <span className={styles.count}>({rows.length})</span></h1>
      </header>

      <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <Link
          href="?tab=pending"
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 6,
            background: tab === 'pending' ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
            color: tab === 'pending' ? 'rgba(var(--primary-rgb), 1)' : 'inherit',
            textDecoration: 'none',
            fontSize: '0.88rem',
            fontWeight: tab === 'pending' ? 600 : 400,
          }}
        >Pendientes</Link>
        <Link
          href="?tab=reviewed"
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 6,
            background: tab === 'reviewed' ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
            color: tab === 'reviewed' ? 'rgba(var(--primary-rgb), 1)' : 'inherit',
            textDecoration: 'none',
            fontSize: '0.88rem',
            fontWeight: tab === 'reviewed' ? 600 : 400,
          }}
        >Revisadas</Link>
      </nav>

      {rows.length === 0 ? (
        <p style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.55)', textAlign: 'center', padding: '2rem' }}>
          {tab === 'pending' ? 'No hay entregas pendientes.' : 'No hay entregas revisadas.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map(r => (
            <li key={r.id} style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1.4fr 0.8fr auto',
              gap: '1rem',
              padding: '0.7rem 0.85rem',
              border: '1px solid rgba(var(--primary-rgb), 0.08)',
              borderRadius: 6,
              alignItems: 'center',
            }}>
              <div>
                <Link href={`/admin/alumnos/${r.user_id}`} style={{ color: 'var(--text-main)' }}>
                  {r.user_name ?? 'Sin nombre'}
                </Link>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.7)' }}>
                {r.course_title} · {r.lesson_title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>
                {formatRelative(r.created_at)}
              </div>
              <Link
                href={`/courses/${r.course_id}/${r.lesson_id}/submissions`}
                style={{ color: 'rgba(var(--primary-rgb), 1)', fontSize: '0.85rem' }}
              >
                Corregir →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
