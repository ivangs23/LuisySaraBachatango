import { describe, it, expect } from 'vitest'
import { getLandingCopy } from '@/app/curso-bachatango/copy'
import { FALLBACK_FAQ } from '@/utils/landing/fallbacks'
import { LOCALES, type Locale } from '@/utils/i18n/types'

/**
 * Un solo relato en la landing de anuncios. Cada regla corresponde a una
 * contradicción que llegó a estar publicada:
 *
 * - Dos preguntas sobre el nivel con respuestas distintas («nivel básico de
 *   bachata» y «totalmente, desde cero»), y la home diciendo una tercera.
 * - «Actualizaciones» incluidas en un curso grabado que no tiene calendario
 *   de actualizaciones.
 * - Una comunidad de alumnos que no existe (D6: se quita de la oferta).
 */

const PREGUNTA_DE_NIVEL: Record<Locale, RegExp> = {
  es: /nivel|experiencia/i,
  en: /level|experience/i,
  fr: /niveau|expérience/i,
  de: /niveau|vorkenntnisse|erfahrung/i,
  it: /livello|esperienza/i,
  ja: /レベル|経験/,
}

const ACTUALIZACIONES: Record<Locale, RegExp> = {
  es: /actualizaci/i,
  en: /update/i,
  fr: /mises? à jour/i,
  de: /aktualisierung/i,
  it: /aggiornament/i,
  ja: /更新/,
}

const COMUNIDAD: Record<Locale, RegExp> = {
  es: /comunidad/i,
  en: /community/i,
  fr: /communauté/i,
  de: /community|gemeinschaft/i,
  it: /comunità/i,
  ja: /コミュニティ/,
}

describe('copy de la landing · un solo relato', () => {
  for (const locale of LOCALES as readonly Locale[]) {
    describe(locale, () => {
      const copy = getLandingCopy(locale)
      const todo = JSON.stringify(copy)

      it('tiene una sola pregunta sobre el nivel', () => {
        const deNivel = copy.faq.filter((f) => PREGUNTA_DE_NIVEL[locale].test(f.q))
        expect(deNivel.map((f) => f.q)).toHaveLength(1)
      })

      it('no promete actualizaciones', () => {
        expect(todo).not.toMatch(ACTUALIZACIONES[locale])
      })

      it('no promete una comunidad', () => {
        expect(todo).not.toMatch(COMUNIDAD[locale])
      })

      it('la FAQ de duración se interpola con el temario real', () => {
        const conCifras = copy.faq.filter((f) => f.a.includes('{lessons}'))
        expect(conCifras).toHaveLength(1)
        for (const marca of ['{modules}', '{lessons}', '{duration}']) {
          expect(conCifras[0].a, `${locale}: falta ${marca}`).toContain(marca)
        }
      })

      it('el número de lecciones de la oferta sale del temario, no de una cifra fija', () => {
        expect(copy.offer.lessonsIncluded).toContain('{lessons}')
        expect(copy.offer.lessonsIncludedFallback).not.toMatch(/\{|\d/)
      })

      it('trae su propio título para la FAQ', () => {
        expect(copy.faqTitle.trim()).not.toBe('')
      })
    })
  }

  it('el nivel se responde igual que en la FAQ de la home', () => {
    // La home lee `landing_faq`; su texto en español es el de FALLBACK_FAQ.
    const home = FALLBACK_FAQ[0].answer
    const landing = getLandingCopy('es').faq.find((f) => PREGUNTA_DE_NIVEL.es.test(f.q))!.a
    expect(home).toContain('El curso empieza desde cero y avanza paso a paso.')
    expect(landing).toContain('El curso empieza desde cero y avanza paso a paso.')
    expect(landing).toContain('Si ya bailas bachata o tango partirás con ventaja')
  })

  it('el título de la FAQ ya no está escrito a mano en el componente', async () => {
    const { readFileSync } = await import('node:fs')
    const fuente = readFileSync('app/curso-bachatango/_components/LandingSections.tsx', 'utf8')
    expect(fuente).not.toContain('Preguntas frecuentes')
  })
})
