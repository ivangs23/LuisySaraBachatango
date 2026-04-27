import Link from 'next/link'
import StudentsToolbar from '@/components/admin/StudentsToolbar'
import StudentsTable from '@/components/admin/StudentsTable'
import { listStudents, type StudentRole, type SubFilter, type SortKey } from '@/utils/admin/queries'
import styles from './alumnos.module.css'

export const dynamic = 'force-dynamic'

const VALID_ROLES = new Set(['member', 'premium', 'admin', 'all'])
const VALID_SUBS = new Set(['active', 'none', 'newMonth', 'all'])
const VALID_SORT = new Set(['created', 'recent', 'name'])

export default async function AlumnosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const q = sp.q ?? ''
  const role = (VALID_ROLES.has(sp.role ?? '') ? (sp.role as StudentRole | 'all') : 'all') as StudentRole | 'all'
  const sub = (VALID_SUBS.has(sp.sub ?? '') ? (sp.sub as SubFilter) : 'all') as SubFilter
  const sort = (VALID_SORT.has(sp.sort ?? '') ? (sp.sort as SortKey) : 'created') as SortKey
  const page = Math.max(1, Number(sp.page ?? '1') || 1)

  const { rows, total, pageSize } = await listStudents({ q, role, sub, sort, page })
  const pages = Math.max(1, Math.ceil(total / pageSize))

  function pageHref(p: number) {
    const u = new URLSearchParams()
    if (q) u.set('q', q)
    if (role !== 'all') u.set('role', role)
    if (sub !== 'all') u.set('sub', sub)
    if (sort !== 'created') u.set('sort', sort)
    if (p > 1) u.set('page', String(p))
    return `?${u.toString()}`
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Alumnos <span className={styles.count}>({total})</span></h1>
      </header>

      <StudentsToolbar initialQ={q} initialRole={role} initialSub={sub} />

      <StudentsTable rows={rows} sort={sort} />

      {pages > 1 && (
        <nav className={styles.pagination} aria-label="Paginación">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page === 1}
            className={`${styles.pageBtn} ${page === 1 ? styles.disabled : ''}`}
          >
            ← Anterior
          </Link>
          <span className={styles.pageInfo}>Página {page} de {pages}</span>
          <Link
            href={pageHref(Math.min(pages, page + 1))}
            aria-disabled={page === pages}
            className={`${styles.pageBtn} ${page === pages ? styles.disabled : ''}`}
          >
            Siguiente →
          </Link>
        </nav>
      )}
    </div>
  )
}
