import Link from 'next/link'
import { CalendarDays, Plus, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { deleteEventForm } from '@/app/events/actions'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  start_date: string
  end_date: string
  location: string
  is_published: boolean
  title: Record<string, string>
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${iso}T00:00:00Z`))
}

export default async function EventosAdminPage() {
  // The admin layout (app/admin/layout.tsx) already calls requireAdmin().
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('events')
    .select('id, start_date, end_date, location, is_published, title')
    .order('start_date', { ascending: false })

  const events = (rows ?? []) as Row[]
  // eslint-disable-next-line react-hooks/purity -- Server Component runs once per request; Date.now() is fine
  const now = Date.now()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 2.5vw, 1.8rem)', fontWeight: 600 }}>
          Eventos <span style={{ fontWeight: 400, color: 'rgba(var(--text-rgb, 30, 30, 30), 0.55)', fontSize: '0.85em' }}>({events.length})</span>
        </h1>
        <Link href="/events/create" style={{
          padding: '0.55rem 1rem',
          background: 'rgba(var(--primary-rgb), 1)',
          color: 'white',
          borderRadius: 6,
          textDecoration: 'none',
          fontSize: '0.9rem',
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        }}>
          <Plus size={14} aria-hidden /> Crear evento
        </Link>
      </header>

      {events.length === 0 ? (
        <p style={{ color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>No hay eventos. Crea el primero.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {events.map(ev => {
            const isPast = new Date(`${ev.end_date}T23:59:59Z`).getTime() < now
            return (
              <article key={ev.id} style={{
                background: 'rgba(var(--primary-rgb), 0.03)',
                border: '1px solid rgba(var(--primary-rgb), 0.1)',
                borderRadius: 10,
                padding: '0.85rem 1rem',
                display: 'flex', flexDirection: 'column', gap: '0.45rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.6)' }}>
                  <CalendarDays size={12} aria-hidden />
                  {fmtDate(ev.start_date)}
                  {ev.end_date !== ev.start_date && <> — {fmtDate(ev.end_date)}</>}
                </div>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                  {ev.title.es ?? '(sin título)'}
                </h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(var(--text-rgb, 30, 30, 30), 0.7)' }}>
                  {ev.location}
                </p>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 4,
                    background: ev.is_published ? 'rgba(34, 197, 94, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                    color: ev.is_published ? '#15803d' : 'inherit',
                  }}>{ev.is_published ? 'Publicado' : 'Borrador'}</span>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 4,
                    background: isPast ? 'rgba(0, 0, 0, 0.1)' : 'rgba(var(--primary-rgb), 0.15)',
                  }}>{isPast ? 'Pasado' : 'Próximo'}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                  <Link href={`/events/${ev.id}/edit`} style={{
                    flex: 1, padding: '0.45rem 0.6rem',
                    border: '1px solid rgba(var(--primary-rgb), 0.2)',
                    borderRadius: 6, color: 'var(--text-main)',
                    textDecoration: 'none', fontSize: '0.82rem',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                  }}>
                    <Pencil size={12} aria-hidden /> Editar
                  </Link>
                  <form action={deleteEventForm.bind(null, ev.id)} style={{ flex: 1 }}>
                    <button type="submit" style={{
                      width: '100%', padding: '0.45rem 0.6rem',
                      background: 'rgba(220, 38, 38, 0.08)',
                      border: '1px solid rgba(220, 38, 38, 0.25)',
                      color: '#b91c1c',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                    }}>
                      <Trash2 size={12} aria-hidden /> Borrar
                    </button>
                  </form>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
