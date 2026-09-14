/**
 * Oferta comercial de un curso: precio real, precio "antes" tachado y plazas
 * anunciadas. Los tres datos viven en `courses` (`price_eur`,
 * `compare_at_price_eur`, `spots_left`) y los edita el admin desde el
 * formulario de curso; aquí sólo se normalizan.
 *
 * Reglas que impone esta capa, no la BD:
 *  - el precio tachado sólo se muestra si supera ESTRICTAMENTE al precio real
 *    (un "antes" igual o menor no es una rebaja, sería ruido engañoso);
 *  - las plazas sólo se muestran si quedan más de 0;
 *  - el precio que se cobra es siempre `price_eur`. `compare_at_price_eur` es
 *    puramente decorativo y nunca llega a Stripe ni al JSON-LD.
 */

export interface CourseOfferInput {
  price_eur?: number | null;
  compare_at_price_eur?: number | null;
  spots_left?: number | null;
}

export interface CourseOffer {
  /** Precio que se cobra. null si el curso no tiene precio configurado. */
  price: number | null;
  /** Precio tachado, ya validado. null si no hay rebaja que enseñar. */
  compareAt: number | null;
  /** Plazas restantes anunciadas. null si no hay que enseñar escasez. */
  spotsLeft: number | null;
  /** Descuento redondeado a entero (21 = "-21 %"). null si no hay rebaja. */
  discountPct: number | null;
}

/** Campos que hay que pedirle a Supabase para construir la oferta. */
export const OFFER_COLUMNS = 'price_eur, compare_at_price_eur, spots_left';

function positiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

export function buildOffer(course: CourseOfferInput | null | undefined): CourseOffer {
  const price = positiveInt(course?.price_eur);
  const rawCompareAt = positiveInt(course?.compare_at_price_eur);
  const compareAt = price !== null && rawCompareAt !== null && rawCompareAt > price ? rawCompareAt : null;
  const spotsLeft = positiveInt(course?.spots_left);
  const discountPct =
    price !== null && compareAt !== null ? Math.round(((compareAt - price) / compareAt) * 100) : null;

  return { price, compareAt, spotsLeft, discountPct };
}

/**
 * Interpola el número de plazas en la plantilla traducida
 * ("Quedan {n} plazas disponibles"). Devuelve null si no hay nada que anunciar,
 * para que quien llama pueda pasar el resultado directo al componente.
 */
export function formatSpotsLeft(template: string | undefined, spotsLeft: number | null): string | null {
  if (!template || spotsLeft === null) return null;
  return template.replace('{n}', String(spotsLeft));
}

/** Columnas a pedir cuando la migración de oferta aún no está aplicada. */
const FALLBACK_OFFER_COLUMNS = 'price_eur';

interface QueryError {
  code?: string | null;
  message?: string | null;
}

interface QueryResult<T> {
  data: T | null;
  error: QueryError | null;
}

/**
 * Lo que devuelve el builder de supabase-js. `data` va como `unknown` porque el
 * parser de tipos de supabase-js no sabe leer un `select()` con plantilla
 * dinámica y devuelve `ParserError`; el tipo real lo fija el genérico `T`.
 */
interface RawQueryResult {
  data: unknown;
  error: QueryError | null;
}

/** Postgres 42703 = undefined_column. PostgREST lo propaga tal cual. */
function isMissingOfferColumn(error: QueryError | null): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  const msg = error.message ?? '';
  return /compare_at_price_eur|spots_left/.test(msg) && /does not exist|no existe/i.test(msg);
}

/**
 * Ejecuta una consulta pidiendo las columnas de oferta y, si la BD todavía no
 * las tiene, la repite pidiendo sólo `price_eur`.
 *
 * Existe porque las migraciones de este repo se aplican a mano en el SQL
 * Editor: si el deploy llega antes que el SQL, sin este reintento el listado
 * de cursos y la landing se quedarían vacíos (y `/courses` lo cachearía 5
 * minutos con `unstable_cache`). Con él, la web sigue vendiendo al precio de
 * siempre y sólo falta el tachado.
 */
export async function selectWithOfferColumns<T>(
  run: (offerColumns: string) => PromiseLike<RawQueryResult>,
): Promise<QueryResult<T>> {
  const full = await run(OFFER_COLUMNS);
  if (!isMissingOfferColumn(full.error)) return { data: (full.data ?? null) as T | null, error: full.error };
  console.warn(
    '[offer] faltan compare_at_price_eur/spots_left en courses: aplica supabase/2026_09_course_offer_fields.sql',
  );
  const fallback = await run(FALLBACK_OFFER_COLUMNS);
  return { data: (fallback.data ?? null) as T | null, error: fallback.error };
}
