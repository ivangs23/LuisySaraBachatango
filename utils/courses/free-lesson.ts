import 'server-only'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { COURSE_ID } from './landing-course'

export interface FreeLesson {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  mux_playback_id: string
  course_id: string
}

/**
 * Lección de muestra que sirve `/clase-gratis`. Es la lección `is_free` de
 * menor `order` del curso de la landing que ya tenga vídeo listo en Mux.
 *
 * Usa el service role en lugar del cliente con sesión por dos motivos: la
 * página es pública y no hay cookies que respetar, y así el resultado no
 * depende de la RLS de `lessons` —que ya ha roto la lectura anónima una vez
 * (ver supabase/MIGRATIONS.md, regresión de agosto 2026)—.
 *
 * Es seguro: el filtro `is_free = true` está fijado aquí, en servidor, y no
 * llega ningún parámetro desde el cliente. No hay forma de pedir otra lección.
 */
export async function getFreeLesson(): Promise<FreeLesson | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  )

  const { data, error } = await supabase
    .from('lessons')
    .select('id, title, description, thumbnail_url, mux_playback_id, course_id')
    .eq('course_id', COURSE_ID)
    .eq('is_free', true)
    .eq('mux_status', 'ready')
    .order('order', { ascending: true })
    .limit(1)

  if (error || !data || data.length === 0) return null

  const row = data[0] as Partial<FreeLesson>
  if (!row.mux_playback_id) return null

  return row as FreeLesson
}
