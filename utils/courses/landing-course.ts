import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { selectWithOfferColumns } from '@/utils/courses/offer';

/** Curso fijo que vende el funnel `/curso-bachatango` y anuncia la home. */
export const COURSE_ID = 'f89a576f-4a77-40f7-93e9-23e6c820ee92';

export interface LandingCourse {
  id: string;
  title: string;
  price_eur: number;
  /** Precio tachado. Opcional: falta si la migración de oferta no está aplicada. */
  compare_at_price_eur?: number | null;
  /** Plazas anunciadas. Opcional por el mismo motivo. */
  spots_left?: number | null;
  image_url: string | null;
}

/**
 * Lee el curso fijo de la landing (publicado). Devuelve null si no existe
 * o no está publicado.
 *
 * Service role en vez del cliente con sesión, por los dos motivos que ya
 * documentan `curriculum.ts` y `free-lesson.ts`: la página es pública y no hay
 * cookies que respetar, y así el curso no depende de la RLS de `courses`.
 * Además es lo que permite cachearlo — `unstable_cache` no puede llamar a
 * `cookies()` por dentro.
 *
 * Solo salen id, título, portada y precio de un curso ya publicado: lo mismo
 * que cualquiera lee en el HTML de la landing.
 */
async function leerCursoDeLaLanding(): Promise<LandingCourse | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  );

  const { data, error } = await selectWithOfferColumns<LandingCourse>((offerColumns) =>
    supabase
      .from('courses')
      .select(`id, title, image_url, ${offerColumns}`)
      .eq('id', COURSE_ID)
      .eq('is_published', true)
      .single(),
  );

  // El error se PROPAGA a propósito: `unstable_cache` no guarda el resultado
  // de una llamada que lanza, así que un fallo de red no se queda pegado
  // cinco minutos.
  //
  // Ojo con el reparto: con `.single()`, "la fila no está o no está
  // publicada" llega como error (PGRST116), no como `data` vacío. O sea que
  // ese caso tampoco se cachea — es correcto pero no gratis, y da igual
  // porque la página hace `notFound()` de todas formas.
  if (error) throw new Error(`[landing-course] ${error.message ?? 'consulta fallida'}`);
  if (!data) return null;
  return data as LandingCourse;
}

const cursoCacheado = unstable_cache(leerCursoDeLaLanding, ['landing-course'], {
  revalidate: 300,
  tags: ['landing-course'],
});

/**
 * Lo consumen el Server Component de `/` y el de `/curso-bachatango`, que es
 * la única fuente de verdad del precio que se anuncia.
 *
 * La caché dura 5 minutos Y se invalida en el acto al editar el curso
 * (`revalidateTag('landing-course')` en app/courses/actions.ts). Lo segundo no
 * es un extra: sin ello la landing podría anunciar un precio viejo mientras el
 * checkout cobra el nuevo, que sale de su propia lectura fresca.
 *
 * Un fallo de base de datos llega aquí como excepción y sale como null: la
 * página decide (`notFound()`), y como no se cacheó, la siguiente petición lo
 * reintenta.
 */
export async function getLandingCourse(): Promise<LandingCourse | null> {
  try {
    return await cursoCacheado();
  } catch (e) {
    console.error('[landing-course] lectura fallida: %s', (e as Error).message);
    return null;
  }
}
