import { describe, it, expect } from 'vitest'
import { buildFaqJsonLd } from '@/utils/seo/faq-jsonld'

describe('buildFaqJsonLd', () => {
  it('produce un FAQPage con una entrada por pregunta', () => {
    const out = buildFaqJsonLd([
      { q: '¿Pregunta uno?', a: 'Respuesta uno.' },
      { q: '¿Pregunta dos?', a: 'Respuesta dos.' },
    ]) as Record<string, unknown>

    expect(out['@type']).toBe('FAQPage')
    expect(out['@context']).toBe('https://schema.org')
    const entities = out.mainEntity as Array<Record<string, unknown>>
    expect(entities).toHaveLength(2)
    expect(entities[0]).toEqual({
      '@type': 'Question',
      name: '¿Pregunta uno?',
      acceptedAnswer: { '@type': 'Answer', text: 'Respuesta uno.' },
    })
  })

  it('descarta entradas con pregunta o respuesta vacías', () => {
    const out = buildFaqJsonLd([
      { q: '¿Válida?', a: 'Sí.' },
      { q: '', a: 'Huérfana.' },
      { q: '¿Sin respuesta?', a: '   ' },
    ]) as Record<string, unknown>
    expect(out.mainEntity as unknown[]).toHaveLength(1)
  })

  it('devuelve mainEntity vacío si no hay ninguna válida', () => {
    const out = buildFaqJsonLd([]) as Record<string, unknown>
    expect(out.mainEntity).toEqual([])
  })
})
