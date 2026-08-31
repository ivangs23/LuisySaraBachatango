import 'server-only'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { COURSE_ID } from './landing-course'

export interface CurriculumLesson {
  id: string
  title: string
  duration: number | null
}

export interface CurriculumModule {
  id: string
  title: string
  order: number
  lessons: CurriculumLesson[]
  /** Duración del módulo más la de sus sublecciones, en segundos. */
  totalSeconds: number
}

export interface Curriculum {
  modules: CurriculumModule[]
  moduleCount: number
  lessonCount: number
  totalSeconds: number
}

interface Row {
  id: string
  title: string
  order: number
  parent_lesson_id: string | null
  duration: number | null
}

/**
 * Formatea segundos para mostrarlos a un comprador: "5 min", "1 h 5 min".
 * Nunca segundos sueltos — a nadie le importa que un módulo dure 312 s.
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return ''
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const rest = mins % 60
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}

/**
 * Temario del curso de la landing, ya agrupado en módulos.
 *
 * La jerarquía la marca `parent_lesson_id`: las filas sin padre son módulos
 * (con `order` 1..N sobre el curso) y las que lo tienen son sublecciones (con
 * `order` relativo a su padre).
 *
 * Usa el service role porque la página es pública y no hay cookies que
 * respetar, y así el temario no depende de la RLS de `lessons` — que ya ha
 * roto la lectura anónima una vez (ver supabase/MIGRATIONS.md).
 *
 * Solo expone títulos y duraciones: ningún `mux_playback_id` sale de aquí.
 */
export async function getCurriculum(): Promise<Curriculum | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  )

  const { data, error } = await supabase
    .from('lessons')
    .select('id, title, order, parent_lesson_id, duration')
    .eq('course_id', COURSE_ID)
    .order('order', { ascending: true })

  if (error || !data || data.length === 0) return null

  const rows = data as Row[]
  const roots = rows.filter((r) => !r.parent_lesson_id)
  if (roots.length === 0) return null

  const byParent = new Map<string, Row[]>()
  for (const r of rows) {
    if (!r.parent_lesson_id) continue
    const list = byParent.get(r.parent_lesson_id) ?? []
    list.push(r)
    byParent.set(r.parent_lesson_id, list)
  }

  const modules: CurriculumModule[] = roots
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((root) => {
      const children = (byParent.get(root.id) ?? []).slice().sort((a, b) => a.order - b.order)
      const totalSeconds =
        (root.duration ?? 0) + children.reduce((sum, c) => sum + (c.duration ?? 0), 0)
      return {
        id: root.id,
        title: root.title,
        order: root.order,
        lessons: children.map((c) => ({ id: c.id, title: c.title, duration: c.duration })),
        totalSeconds,
      }
    })

  return {
    modules,
    moduleCount: modules.length,
    // Módulos + sublecciones reconocidas. Las huérfanas (padre inexistente)
    // quedan fuera a propósito: contarlas mentiría sobre lo que se compra.
    lessonCount: modules.reduce((n, m) => n + 1 + m.lessons.length, 0),
    totalSeconds: modules.reduce((n, m) => n + m.totalSeconds, 0),
  }
}
