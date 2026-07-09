import { createClient } from '@/utils/supabase/server';
import { COURSE_ID } from './copy';

export interface LandingCourse {
  id: string;
  title: string;
  price_eur: number;
  image_url: string | null;
}

/**
 * Lee el curso fijo de la landing (publicado). Devuelve null si no existe
 * o no está publicado. Se usa desde el Server Component de la landing.
 */
export async function getLandingCourse(): Promise<LandingCourse | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, price_eur, image_url')
    .eq('id', COURSE_ID)
    .eq('is_published', true)
    .single();

  if (error || !data) return null;
  return data as LandingCourse;
}
