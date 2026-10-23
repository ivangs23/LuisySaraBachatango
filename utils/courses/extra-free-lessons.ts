import 'server-only'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { COURSE_ID } from './landing-course'

/**
 * Las dos clases que se mandan por email a quien deja su correo en la landing
 * (D4, 2026-10-23): POSTURAS, la base, y SEGUNDO BÁSICO - CUADRADO, el paso
 * que sigue al de la clase abierta. En este orden se pintan.
 *
 * Constantes y no `is_free`: no deben aparecer como gratuitas en la ficha del
 * curso ni competir con la clase abierta de la landing (`free-lesson.ts` coge
 * la `is_free` de menor `order`).
 */
export const EXTRA_FREE_LESSON_IDS = [
  '3597aa87-27de-480b-899a-7a7880b27ce4', // POSTURAS
  'd4a5eed2-3c2c-497c-af48-fbef072c98f2', // SEGUNDO BÁSICO - CUADRADO
] as const

export interface ExtraFreeLesson {
  id: string
  title: string
  description: string | null
  mux_playback_id: string
}

/**
 * Lee las dos clases con el service role: la página es pública (se entra con
 * el token del email, sin sesión) y estas lecciones no son `is_free`, así que
 * la RLS de `lessons` no se las enseñaría a nadie.
 *
 * Es seguro porque los IDs están fijados aquí: desde la URL no se puede pedir
 * otra lección. Solo salen título, descripción y playback ID, que sin token
 * firmado no reproduce nada.
 *
 * Sin caché: la página se visita poco y los tokens se firman en cada render.
 * Si la BD falla, lista vacía y la página lo dice.
 */
export async function getExtraFreeLessons(): Promise<ExtraFreeLesson[]> {
  try {
    const { data, error } = await createSupabaseAdmin()
      .from('lessons')
      .select('id, title, description, mux_playback_id')
      .in('id', EXTRA_FREE_LESSON_IDS)
      .eq('course_id', COURSE_ID)
      .eq('mux_status', 'ready')

    if (error || !data) {
      if (error) console.error('[extra-free-lessons] lectura fallida: %s', error.message)
      return []
    }

    const rows = data as Partial<ExtraFreeLesson>[]
    return EXTRA_FREE_LESSON_IDS
      .map((id) => rows.find((r) => r.id === id))
      .filter((r): r is ExtraFreeLesson => !!r && !!r.mux_playback_id)
  } catch (e) {
    console.error('[extra-free-lessons] excepción: %s', (e as Error).message)
    return []
  }
}
