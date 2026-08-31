import 'server-only'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { requireAdmin } from '@/utils/auth/require-admin'
import { rangeStartIso, type Range } from '@/utils/admin/queries'
import { FUNNEL_STEPS } from '@/utils/analytics/tracked-paths'

export type FunnelStep = {
  path: string
  label: string
  /** Únicos/día distintos que alcanzaron este paso en el rango. */
  visitors: number
  /** % de los del paso anterior que llegaron aquí. null en el primero. */
  dropFromPrev: number | null
}

export type TrafficDay = { date: string; views: number; uniques: number }

type Row = { path: string; visitor_hash: string; created_at: string }

/**
 * Lee los eventos del rango. Agrega en JS, igual que el resto de
 * `utils/admin/queries.ts`: PostgREST no hace `count(distinct)` y a este volumen
 * no compensa una vista materializada. Ver «Cuándo habrá que volver» en el spec.
 */
async function fetchRows(range: Range): Promise<Row[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const since = rangeStartIso(range)

  const { data, error } = await sb
    .from('landing_events')
    .select('path, visitor_hash, created_at')
    .gte('created_at', since ?? '1970-01-01T00:00:00Z')

  if (error || !data) return []
  return data as Row[]
}

/**
 * Embudo por pasos.
 *
 * IMPORTANTE: son proporciones entre pasos, no recorridos seguidos persona a
 * persona. El hash caduca cada día, así que quien ve la página el martes y
 * compra el jueves cuenta en ambos pasos sin quedar enlazado. Encadenarlos
 * exigiría identificadores entre días, que es justo lo que se decidió no tener.
 * La página lo dice como nota al pie.
 */
export async function getLandingFunnel(range: Range): Promise<FunnelStep[]> {
  const rows = await fetchRows(range)

  const uniquesByPath = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = uniquesByPath.get(r.path) ?? new Set<string>()
    set.add(r.visitor_hash)
    uniquesByPath.set(r.path, set)
  }

  let prev: number | null = null
  return FUNNEL_STEPS.map((step) => {
    const visitors = uniquesByPath.get(step.path)?.size ?? 0
    const dropFromPrev = prev === null || prev === 0 ? null : (visitors / prev) * 100
    prev = visitors
    return { path: step.path, label: step.label, visitors, dropFromPrev }
  })
}

/** Serie diaria: vistas totales y únicos de ese día. */
export async function getLandingTraffic(range: Range): Promise<TrafficDay[]> {
  const rows = await fetchRows(range)

  const byDay = new Map<string, { views: number; uniques: Set<string> }>()
  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    const entry = byDay.get(day) ?? { views: 0, uniques: new Set<string>() }
    entry.views += 1
    entry.uniques.add(r.visitor_hash)
    byDay.set(day, entry)
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, views: v.views, uniques: v.uniques.size }))
}
