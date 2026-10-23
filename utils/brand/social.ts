/**
 * Cuentas oficiales de Luis y Sara en redes, las que enlaza el pie de página.
 *
 * Son constantes a propósito. Antes el pie las leía del último perfil
 * actualizado que tuviera Instagram, fuera de quien fuera: cualquier alumno
 * que rellenara sus redes en /profile pasaba a ser el Instagram de la marca
 * para todo el sitio. Y era una consulta a la BD en el layout, en cada página.
 *
 * Confirmadas por el usuario el 2026-10-23 (las que tenía el perfil admin),
 * sin los parámetros de rastreo con que se copiaron de la app de TikTok.
 */
export const SOCIAL_URLS = {
  instagram: 'https://www.instagram.com/luisysaradance/',
  facebook: 'https://www.facebook.com/profile.php?id=61594187004901',
  tiktok: 'https://www.tiktok.com/@luisysara.dance',
  youtube: 'https://www.youtube.com/@luisysara',
} as const;
