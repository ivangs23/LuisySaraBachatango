import Image from 'next/image'
import Link from 'next/link'
import { Plus, Pencil, BookOpen } from 'lucide-react'
import { listCoursesWithStats } from '@/utils/admin/queries'

export const dynamic = 'force-dynamic'

export default async function CursosAdminPage() {
  const courses = await listCoursesWithStats()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 2.5vw, 1.8rem)', fontWeight: 600 }}>
          Cursos <span style={{ fontWeight: 400, color: 'rgba(var(--text-rgb, 30, 30, 30), 0.55)', fontSize: '0.85em' }}>({courses.length})</span>
        </h1>
        <Link href="/courses/create" style={{
          padding: '0.55rem 1rem',
          background: 'rgba(var(--primary-rgb), 1)',
          color: 'white',
          borderRadius: 6,
          textDecoration: 'none',
          fontSize: '0.9rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}>
          <Plus size={14} aria-hidden /> Crear curso
        </Link>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
      }}>
        {courses.map(c => (
          <article key={c.id} style={{
            background: 'rgba(var(--primary-rgb), 0.03)',
            border: '1px solid rgba(var(--primary-rgb), 0.1)',
            borderRadius: 10,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ position: 'relative', aspectRatio: '16 / 9', background: 'rgba(var(--primary-rgb), 0.08)' }}>
              {c.image_url
                ? <Image src={c.image_url} alt="" fill style={{ objectFit: 'cover' }} sizes="280px" />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(var(--primary-rgb), 1)' }}><BookOpen size={28} /></div>}
              {!c.is_published && (
                <span style={{
                  position: 'absolute', top: 8, left: 8,
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 4,
                }}>Borrador</span>
              )}
              <span style={{
                position: 'absolute', top: 8, right: 8,
                background: 'rgba(var(--primary-rgb), 0.85)',
                color: 'white', fontSize: '0.7rem',
                padding: '0.15rem 0.5rem', borderRadius: 4,
              }}>{c.course_type === 'membership' ? 'Membresía' : 'Completo'}</span>
            </div>
            <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{c.title}</h2>
              <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 0.75rem', margin: 0, fontSize: '0.8rem' }}>
                <dt style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>Lecciones</dt>
                <dd style={{ margin: 0 }}>{c.lessonsCount}</dd>
                <dt style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>Alumnos</dt>
                <dd style={{ margin: 0 }}>{c.studentsWithAccess}</dd>
                <dt style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>Progreso</dt>
                <dd style={{ margin: 0 }}>{c.avgCompletion}%</dd>
                <dt style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>Ingresos</dt>
                <dd style={{ margin: 0 }}>€{c.revenueEur.toFixed(0)}</dd>
              </dl>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                <Link href={`/courses/${c.id}/edit`} style={{
                  flex: 1, padding: '0.45rem 0.6rem',
                  border: '1px solid rgba(var(--primary-rgb), 0.2)',
                  borderRadius: 6, color: 'var(--text-main)',
                  textDecoration: 'none', fontSize: '0.82rem',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                }}>
                  <Pencil size={12} aria-hidden /> Editar
                </Link>
                <Link href={`/courses/${c.id}/add-lesson`} style={{
                  flex: 1, padding: '0.45rem 0.6rem',
                  background: 'rgba(var(--primary-rgb), 0.08)',
                  border: '1px solid rgba(var(--primary-rgb), 0.2)',
                  borderRadius: 6, color: 'var(--text-main)',
                  textDecoration: 'none', fontSize: '0.82rem',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                }}>
                  <Plus size={12} aria-hidden /> Lección
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
