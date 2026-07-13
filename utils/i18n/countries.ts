/**
 * Country allowlist for the landing registration form (Spanish names).
 * Kept intentionally broad but finite so the server can reject arbitrary input.
 */
export const COUNTRIES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'ES', name: 'España' }, { code: 'MX', name: 'México' }, { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' }, { code: 'CL', name: 'Chile' }, { code: 'PE', name: 'Perú' },
  { code: 'VE', name: 'Venezuela' }, { code: 'EC', name: 'Ecuador' }, { code: 'UY', name: 'Uruguay' },
  { code: 'PY', name: 'Paraguay' }, { code: 'BO', name: 'Bolivia' }, { code: 'CR', name: 'Costa Rica' },
  { code: 'PA', name: 'Panamá' }, { code: 'DO', name: 'República Dominicana' }, { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' }, { code: 'SV', name: 'El Salvador' }, { code: 'NI', name: 'Nicaragua' },
  { code: 'PR', name: 'Puerto Rico' }, { code: 'CU', name: 'Cuba' },
  { code: 'US', name: 'Estados Unidos' }, { code: 'FR', name: 'Francia' }, { code: 'DE', name: 'Alemania' },
  { code: 'IT', name: 'Italia' }, { code: 'PT', name: 'Portugal' }, { code: 'GB', name: 'Reino Unido' },
  { code: 'IE', name: 'Irlanda' }, { code: 'NL', name: 'Países Bajos' }, { code: 'BE', name: 'Bélgica' },
  { code: 'CH', name: 'Suiza' }, { code: 'AT', name: 'Austria' }, { code: 'SE', name: 'Suecia' },
  { code: 'NO', name: 'Noruega' }, { code: 'DK', name: 'Dinamarca' }, { code: 'FI', name: 'Finlandia' },
  { code: 'PL', name: 'Polonia' }, { code: 'JP', name: 'Japón' }, { code: 'CA', name: 'Canadá' },
  { code: 'BR', name: 'Brasil' }, { code: 'AU', name: 'Australia' }, { code: 'OT', name: 'Otro' },
]

const CODES = new Set(COUNTRIES.map(c => c.code))
export function isValidCountry(code: string): boolean {
  return CODES.has(code)
}
