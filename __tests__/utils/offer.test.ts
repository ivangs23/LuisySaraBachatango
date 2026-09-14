import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildOffer, formatSpotsLeft, selectWithOfferColumns, OFFER_COLUMNS } from '@/utils/courses/offer'

beforeEach(() => vi.restoreAllMocks())

describe('buildOffer', () => {
  it('normaliza una oferta completa y calcula el descuento', () => {
    expect(buildOffer({ price_eur: 119, compare_at_price_eur: 150, spots_left: 5 })).toEqual({
      price: 119,
      compareAt: 150,
      spotsLeft: 5,
      discountPct: 21,
    })
  })

  it('descarta el tachado cuando no supera al precio real', () => {
    expect(buildOffer({ price_eur: 119, compare_at_price_eur: 119 }).compareAt).toBeNull()
    expect(buildOffer({ price_eur: 119, compare_at_price_eur: 90 }).compareAt).toBeNull()
    expect(buildOffer({ price_eur: 119, compare_at_price_eur: 119 }).discountPct).toBeNull()
  })

  it('descarta plazas a 0 o negativas', () => {
    expect(buildOffer({ price_eur: 119, spots_left: 0 }).spotsLeft).toBeNull()
    expect(buildOffer({ price_eur: 119, spots_left: -3 }).spotsLeft).toBeNull()
  })

  it('tolera null, undefined y valores no numéricos', () => {
    expect(buildOffer(null)).toEqual({ price: null, compareAt: null, spotsLeft: null, discountPct: null })
    expect(buildOffer(undefined).price).toBeNull()
    expect(buildOffer({ price_eur: 0 }).price).toBeNull()
    expect(buildOffer({ price_eur: Number.NaN }).price).toBeNull()
  })

  it('sin precio real no hay tachado aunque venga compare_at', () => {
    expect(buildOffer({ price_eur: null, compare_at_price_eur: 150 }).compareAt).toBeNull()
  })
})

describe('formatSpotsLeft', () => {
  it('interpola el número de plazas', () => {
    expect(formatSpotsLeft('Quedan {n} plazas disponibles', 5)).toBe('Quedan 5 plazas disponibles')
  })

  it('devuelve null cuando no hay plazas o no hay plantilla', () => {
    expect(formatSpotsLeft('Quedan {n} plazas', null)).toBeNull()
    expect(formatSpotsLeft(undefined, 5)).toBeNull()
  })
})

describe('selectWithOfferColumns', () => {
  it('pide las columnas de oferta y devuelve los datos tal cual', async () => {
    const run = vi.fn(async () => ({ data: [{ id: 'c1' }], error: null }))
    const result = await selectWithOfferColumns<{ id: string }[]>(run)
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenCalledWith(OFFER_COLUMNS)
    expect(result).toEqual({ data: [{ id: 'c1' }], error: null })
  })

  it('reintenta sin las columnas nuevas si la BD aún no las tiene', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: '42703', message: 'column courses.compare_at_price_eur does not exist' },
      })
      .mockResolvedValueOnce({ data: [{ id: 'c1' }], error: null })

    const result = await selectWithOfferColumns<{ id: string }[]>(run)
    expect(run).toHaveBeenCalledTimes(2)
    expect(run).toHaveBeenNthCalledWith(2, 'price_eur')
    expect(result.data).toEqual([{ id: 'c1' }])
  })

  it('no reintenta ante un error que no sea de columna ausente', async () => {
    const run = vi.fn(async () => ({ data: null, error: { code: 'PGRST116', message: 'no rows' } }))
    const result = await selectWithOfferColumns<{ id: string }>(run)
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.error).toEqual({ code: 'PGRST116', message: 'no rows' })
  })
})
