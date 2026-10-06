/**
 * Certificado privado de aprovechamiento: datos fijos del documento y helpers
 * puros. Nada de Supabase aquí — la emisión vive en
 * `app/courses/completion-actions.ts` y la página en
 * `app/courses/[courseId]/certificado/page.tsx`.
 *
 * Los nombres y la ciudad son datos del negocio, no traducibles: van en
 * constantes y no en `utils/i18n/dictionaries/*`.
 */

export interface CertificateSignatory {
  name: string;
}

/** Quien firma el documento. El cargo ("Directores") sí se traduce. */
export const CERTIFICATE_SIGNATORIES: readonly CertificateSignatory[] = [
  { name: 'Luis Alberto Montero del Alba' },
  { name: 'Sara García de la Fuente' },
] as const;

/** Ciudad de expedición impresa en el pie ("Expedido en Badajoz, a ..."). */
export const CERTIFICATE_CITY = 'Badajoz';

/** Marca que encabeza el documento. Nombre propio: igual en los 6 idiomas. */
export const CERTIFICATE_BRAND = 'Luis y Sara Bachatango';

/**
 * Alfabeto del código: base32 RFC 4648 sin 0, 1, 8 ni 9, para que nadie lea un
 * 0 donde hay una O al dictar el código por teléfono. Debe seguir cuadrando con
 * el CHECK `^LSB-[0-9]{4}-[A-Z2-7]{4}$` de
 * `supabase/2026_10_course_completions.sql`.
 */
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CODE_LENGTH = 4;
const CODE_PREFIX = 'LSB';

export const CERTIFICATE_CODE_RE = /^LSB-[0-9]{4}-[A-Z2-7]{4}$/;

/** Cuántos bytes aleatorios necesita `generateCertificateCode`. */
export const CERTIFICATE_CODE_BYTES = CODE_LENGTH;

/**
 * Construye el código a partir de bytes aleatorios que inyecta quien llama
 * (`crypto.randomBytes` en el servidor). Se mantiene pura para poder testear el
 * formato sin tocar el CSPRNG.
 *
 * El módulo introduce un sesgo despreciable (256 % 32 === 0, de hecho ninguno
 * con un alfabeto de 32 símbolos), y el código no es un secreto: es una
 * referencia legible, no un token de autenticación.
 */
export function generateCertificateCode(year: number, bytes: Uint8Array): string {
  if (bytes.length < CODE_LENGTH) {
    throw new Error(`generateCertificateCode necesita ${CODE_LENGTH} bytes`);
  }
  const safeYear = Number.isFinite(year) ? Math.abs(Math.trunc(year)) % 10000 : 0;
  let suffix = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    suffix += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `${CODE_PREFIX}-${String(safeYear).padStart(4, '0')}-${suffix}`;
}

const NAME_MIN = 2;
const NAME_MAX = 80;

/**
 * Normaliza el nombre que el alumno escribe antes de congelarlo en la fila.
 * Se queda sólo con letras (de cualquier alfabeto), marcas diacríticas,
 * espacios y los separadores que de verdad aparecen en un nombre: guion,
 * apóstrofo y punto. Así no entran saltos de línea, emojis ni marcado que
 * desmaqueten el documento impreso.
 *
 * Devuelve null si lo que queda no parece un nombre, y el llamante rechaza.
 */
export function normalizeRecipientName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\s'’.\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < NAME_MIN) return null;
  return cleaned.slice(0, NAME_MAX).trim();
}

/** Fecha larga en el idioma activo: "6 de octubre de 2026", "October 6, 2026". */
export function formatCertificateDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}
