import { describe, it, expect, vi, beforeEach } from 'vitest'

const single = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ single }),
        }),
      }),
    }),
  })),
}))

vi.mock('next/cache', () => ({
  // La caché se prueba por su contrato (las etiquetas) en
  // landing-cache-tags.test.ts; aquí interesa la consulta, así que
  // `unstable_cache` es la identidad.
  unstable_cache: (fn: unknown) => fn,
}))

process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-de-test'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jytokoxbsykoyifzbjkd.supabase.co'

import { getLandingCourse, COURSE_ID } from '@/utils/courses/landing-course'

beforeEach(() => vi.clearAllMocks())

describe('getLandingCourse', () => {
  it('expone un COURSE_ID con forma de uuid', () => {
    expect(COURSE_ID).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('devuelve el curso cuando existe y está publicado', async () => {
    single.mockResolvedValue({
      data: { id: 'f89a576f-4a77-40f7-93e9-23e6c820ee92', title: 'CURSO BACHATANGO', price_eur: 199, image_url: 'x.png' },
      error: null,
    })
    const course = await getLandingCourse()
    expect(course).toEqual({
      id: 'f89a576f-4a77-40f7-93e9-23e6c820ee92',
      title: 'CURSO BACHATANGO',
      price_eur: 199,
      image_url: 'x.png',
    })
  })

  it('devuelve null cuando no existe / no publicado', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const course = await getLandingCourse()
    expect(course).toBeNull()
  })

  it('devuelve null cuando no hay datos aunque no haya error', async () => {
    single.mockResolvedValue({ data: null, error: null })
    expect(await getLandingCourse()).toBeNull()
  })

  it('no repite la consulta cuando la fila simplemente no está', async () => {
    single.mockResolvedValue({ data: null, error: null })
    expect(await getLandingCourse()).toBeNull()
    expect(single).toHaveBeenCalledTimes(1)
  })

  it('devuelve null sin SUPABASE_SERVICE_ROLE_KEY', async () => {
    const original = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(await getLandingCourse()).toBeNull()
    process.env.SUPABASE_SERVICE_ROLE_KEY = original
  })
})
