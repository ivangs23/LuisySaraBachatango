import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
// Sin caché en los tests: cada llamada llega a la consulta mockeada.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

const orderMock = vi.fn()
const eqMock = vi.fn(() => ({ order: orderMock }))
const selectMock = vi.fn(() => ({ order: orderMock, eq: eqMock }))
const fromMock = vi.fn(() => ({ select: selectMock }))
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({ from: fromMock }) }))

import { pickLocalized } from '@/utils/landing/locale-text'
import { getLandingStats, getTestimonials, getFaqItems } from '@/utils/landing/content'
import { FALLBACK_STATS } from '@/utils/landing/fallbacks'

describe('pickLocalized', () => {
  const map = { es: 'hola', en: 'hi', fr: '' }

  it('devuelve el idioma pedido', () => {
    expect(pickLocalized(map, 'en')).toBe('hi')
  })

  it('cae a español si falta', () => {
    expect(pickLocalized(map, 'ja')).toBe('hola')
  })

  it('cae a español si está vacío', () => {
    expect(pickLocalized(map, 'fr')).toBe('hola')
  })

  it('nunca devuelve undefined con entradas raras', () => {
    expect(pickLocalized(null, 'es')).toBe('')
    expect(pickLocalized('texto', 'es')).toBe('')
    expect(pickLocalized({}, 'es')).toBe('')
  })
})

describe('getLandingStats', () => {
  beforeEach(() => { orderMock.mockReset() })

  it('devuelve las cifras de la BD', async () => {
    orderMock.mockResolvedValue({
      data: [
        { key: 'years', value: '26' }, { key: 'students', value: '600' },
        { key: 'countries', value: '31' }, { key: 'titles', value: '101' },
      ],
      error: null,
    })
    expect(await getLandingStats()).toEqual({ years: '26', students: '600', countries: '31', titles: '101' })
  })

  it('cae a los valores de código si la consulta falla', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getLandingStats()).toEqual({ ...FALLBACK_STATS })
  })

  it('rellena con los de código las claves que falten', async () => {
    orderMock.mockResolvedValue({ data: [{ key: 'years', value: '26' }], error: null })
    const s = await getLandingStats()
    expect(s.years).toBe('26')
    expect(s.students).toBe(FALLBACK_STATS.students)
  })

  it('ignora claves desconocidas que vengan de la BD', async () => {
    orderMock.mockResolvedValue({ data: [{ key: 'hackeada', value: '9' }], error: null })
    expect(await getLandingStats()).toEqual({ ...FALLBACK_STATS })
  })
})

describe('getTestimonials', () => {
  beforeEach(() => { orderMock.mockReset(); eqMock.mockClear() })

  it('localiza las citas', async () => {
    orderMock.mockResolvedValue({
      data: [{ id: 'a', name: 'Ana', quote: { es: 'genial', en: 'great' }, stars: 5 }],
      error: null,
    })
    expect(await getTestimonials('en')).toEqual([{ id: 'a', name: 'Ana', quote: 'great', stars: 5 }])
  })

  it('pide solo los publicados', async () => {
    orderMock.mockResolvedValue({ data: [], error: null })
    await getTestimonials('es')
    expect(eqMock).toHaveBeenCalledWith('is_published', true)
  })

  // Un testimonio tiene que ser de un alumno real. Si no hay ninguno
  // publicado, o la BD falla, la sección desaparece: nunca se rellena con
  // citas escritas en el código.
  it('devuelve una lista vacía si no hay filas publicadas', async () => {
    orderMock.mockResolvedValue({ data: [], error: null })
    expect(await getTestimonials('es')).toEqual([])
  })

  it('devuelve una lista vacía si la consulta falla', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getTestimonials('es')).toEqual([])
  })

  it('devuelve una lista vacía si el cliente lanza', async () => {
    orderMock.mockRejectedValue(new Error('red caída'))
    expect(await getTestimonials('es')).toEqual([])
  })
})

describe('getFaqItems', () => {
  beforeEach(() => { orderMock.mockReset() })

  it('localiza pregunta y respuesta', async () => {
    orderMock.mockResolvedValue({
      data: [{ id: 'f', question: { es: '¿Qué?', en: 'What?' }, answer: { es: 'Esto', en: 'This' } }],
      error: null,
    })
    expect(await getFaqItems('en')).toEqual([{ id: 'f', question: 'What?', answer: 'This' }])
  })

  it('cae a los de código si la consulta falla', async () => {
    orderMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect((await getFaqItems('es')).length).toBeGreaterThan(0)
  })
})
