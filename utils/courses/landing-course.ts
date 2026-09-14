import { createClient } from '@/utils/supabase/server';
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
 * o no está publicado. Lo consumen el Server Component de `/` y el de
 * `/curso-bachatango`, que es la única fuente de verdad del precio.
 */
export async function getLandingCourse(): Promise<LandingCourse | null> {
  const supabase = await createClient();
  const { data, error } = await selectWithOfferColumns<LandingCourse>((offerColumns) =>
    supabase
      .from('courses')
      .select(`id, title, image_url, ${offerColumns}`)
      .eq('id', COURSE_ID)
      .eq('is_published', true)
      .single(),
  );

  if (error || !data) return null;
  return data as LandingCourse;
}
