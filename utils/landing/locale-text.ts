import type { Locale } from '@/utils/i18n/types'

/**
 * Texto en el idioma pedido, con respaldo a español.
 *
 * Mismo criterio que `components/EventsClient.tsx:51`, extraído aquí para que
 * events y el contenido de la landing no puedan divergir.
 *
 * Tolera entradas raras a propósito: viene de una columna jsonb, y un `null`
 * o una forma inesperada no puede hacer explotar la página.
 */
export function pickLocalized(map: unknown, locale: Locale): string {
  if (typeof map !== 'object' || map === null) return ''
  const m = map as Record<string, unknown>
  const wanted = m[locale]
  if (typeof wanted === 'string' && wanted.length > 0) return wanted
  const es = m.es
  return typeof es === 'string' ? es : ''
}
