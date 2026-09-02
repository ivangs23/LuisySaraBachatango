import { describe, it, expect } from 'vitest'
import { getLandingCopy, type LandingCopy } from '@/app/curso-bachatango/copy'
import { LOCALES, type Locale } from '@/utils/i18n/types'

/**
 * El embudo estuvo solo en español mientras el resto del sitio se anunciaba en
 * seis idiomas: un visitante inglés hacía clic desde una home traducida y
 * aterrizaba en español justo donde se le pide pagar. Estas comprobaciones
 * existen para que ese hueco no vuelva a abrirse sin que nadie se entere.
 */

/** Recorre el objeto y devuelve [ruta, texto] de cada cadena. */
function cadenas(v: unknown, ruta = ''): Array<[string, string]> {
  if (typeof v === 'string') return [[ruta, v]]
  if (Array.isArray(v)) return v.flatMap((x, i) => cadenas(x, `${ruta}[${i}]`))
  if (v && typeof v === 'object') {
    return Object.entries(v).flatMap(([k, x]) => cadenas(x, ruta ? `${ruta}.${k}` : k))
  }
  return []
}

const base = getLandingCopy('es')
const rutasEs = cadenas(base).map(([r]) => r).sort()

describe('copy del embudo por idioma', () => {
  it('cubre los seis idiomas del sitio', () => {
    expect([...LOCALES].sort()).toEqual(['de', 'en', 'es', 'fr', 'it', 'ja'])
  })

  for (const locale of LOCALES as readonly Locale[]) {
    describe(locale, () => {
      const copy: LandingCopy = getLandingCopy(locale)
      const pares = cadenas(copy)

      it('tiene exactamente las mismas claves que el español', () => {
        expect(pares.map(([r]) => r).sort()).toEqual(rutasEs)
      })

      it('no deja ningún texto vacío', () => {
        const vacios = pares.filter(([, t]) => t.trim().length === 0).map(([r]) => r)
        expect(vacios).toEqual([])
      })

      it('conserva los marcadores de la plantilla del temario', () => {
        // `summary` se interpola con datos reales de la BD; perder un
        // marcador al traducir dejaría el dato fuera de la página.
        for (const marca of ['{modules}', '{lessons}', '{duration}']) {
          expect(copy.learn.summary, `${locale}: falta ${marca}`).toContain(marca)
        }
      })

      it('mantiene el nombre del producto sin traducir', () => {
        // Es el título del curso en la BD y lo que aparece en la factura de
        // Stripe: traducirlo rompería la correspondencia con lo que se compra.
        expect(copy.offer.title).toContain('CURSO BACHATANGO')
        expect(copy.sticky.brand).toContain('CURSO BACHATANGO')
      })

      if (locale !== 'es') {
        it('está traducido de verdad, no copiado del español', () => {
          // Idéntico a propósito: nombre de la marca y del producto, que no se
          // traducen en ningún idioma. Los testimonios llevan nombre y ciudad
          // reales, que tampoco cambian, pero sus rutas terminan en `.author`.
          const EXENTOS = (ruta: string) =>
            ruta === 'sticky.brand' || ruta.endsWith('.author')

          const esMap = new Map(cadenas(base))
          const iguales = pares
            .filter(([r, t]) => !EXENTOS(r) && t.length > 25 && esMap.get(r) === t)
            .map(([r]) => r)
          expect(iguales, `${locale}: sin traducir`).toEqual([])
        })
      }
    })
  }

  it('cae al español ante un idioma desconocido', () => {
    expect(getLandingCopy('pt' as Locale)).toBe(base)
  })
})
