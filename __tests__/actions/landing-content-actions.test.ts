import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const requireAdminMock = vi.fn().mockResolvedValue({ id: 'admin' })
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => requireAdminMock() }))

const upsertMock = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({ from: () => ({ upsert: upsertMock }) }),
}))

const revalidateMock = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidateMock(p) }))

import { updateStats } from '@/app/admin/landing/contenido/actions'
import { parseStatsForm, parseTestimonialForm, parseFaqForm } from '@/app/admin/landing/contenido/_lib/parse'

function fd(v: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(v).forEach(([k, val]) => f.append(k, val))
  return f
}

const OK_STATS = { years: '26', students: '600', countries: '31', titles: '101' }

describe('parseStatsForm', () => {
  it('acepta las cuatro claves', () => {
    expect('payload' in parseStatsForm(fd(OK_STATS))).toBe(true)
  })

  it('rechaza un valor vacío', () => {
    expect('error' in parseStatsForm(fd({ ...OK_STATS, years: '' }))).toBe(true)
  })

  it('ignora claves que no son del conjunto fijo', () => {
    const r = parseStatsForm(fd({ ...OK_STATS, hackeada: '9' }))
    if (!('payload' in r)) throw new Error('debería parsear')
    expect(r.payload.map((p) => p.key)).not.toContain('hackeada')
    expect(r.payload).toHaveLength(4)
  })
})

describe('parseTestimonialForm', () => {
  it('exige el español', () => {
    const r = parseTestimonialForm(fd({ name: 'Ana', quote_es: '', quote_en: 'hi', stars: '5', position: '1' }))
    expect('error' in r).toBe(true)
  })

  it('exige nombre', () => {
    const r = parseTestimonialForm(fd({ name: '  ', quote_es: 'hola', stars: '5', position: '1' }))
    expect('error' in r).toBe(true)
  })

  it('rechaza estrellas fuera de 1..5', () => {
    for (const stars of ['0', '6', 'x']) {
      const r = parseTestimonialForm(fd({ name: 'Ana', quote_es: 'hola', stars, position: '1' }))
      expect('error' in r, `stars=${stars}`).toBe(true)
    }
  })

  it('recoge los seis idiomas', () => {
    const r = parseTestimonialForm(fd({
      name: 'Ana', stars: '5', position: '1',
      quote_es: 'hola', quote_en: 'hi', quote_fr: 'salut', quote_de: 'hallo', quote_it: 'ciao', quote_ja: 'やあ',
    }))
    if (!('payload' in r)) throw new Error('debería parsear')
    expect(Object.keys(r.payload.quote as object)).toHaveLength(6)
  })
})

describe('parseFaqForm', () => {
  it('exige pregunta y respuesta en español', () => {
    expect('error' in parseFaqForm(fd({ question_es: '', answer_es: 'a' }))).toBe(true)
    expect('error' in parseFaqForm(fd({ question_es: 'q', answer_es: '' }))).toBe(true)
  })

  it('acepta con solo español', () => {
    expect('payload' in parseFaqForm(fd({ question_es: 'q', answer_es: 'a', position: '1' }))).toBe(true)
  })
})

describe('updateStats', () => {
  beforeEach(() => {
    upsertMock.mockClear().mockResolvedValue({ error: null })
    revalidateMock.mockClear()
    requireAdminMock.mockResolvedValue({ id: 'admin' })
  })

  it('guarda y revalida la home', async () => {
    await updateStats(fd(OK_STATS))
    expect(upsertMock).toHaveBeenCalled()
    expect(revalidateMock).toHaveBeenCalledWith('/')
  })

  it('revalida también la OG image', async () => {
    await updateStats(fd(OK_STATS))
    expect(revalidateMock).toHaveBeenCalledWith('/opengraph-image')
  })

  it('rechaza sin sesión de admin', async () => {
    requireAdminMock.mockRejectedValue(new Error('no'))
    const r = await updateStats(fd(OK_STATS))
    expect(r).toEqual({ error: 'No autorizado' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('devuelve el error si la BD falla', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'boom' } })
    expect(await updateStats(fd(OK_STATS))).toEqual({ error: 'boom' })
  })
})
