import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNotFound = vi.fn(() => { throw new Error('NOT_FOUND') })
vi.mock('next/navigation', () => ({ notFound: () => mockNotFound() }))
// La página lee la cookie flash `landing_form` (re-echo de campos sin PII en la URL).
const { mockCookieGet } = vi.hoisted(() => ({ mockCookieGet: vi.fn().mockReturnValue(undefined) }))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }) }))
const { mockGetUser, mockSingle } = vi.hoisted(() => ({
  mockGetUser: vi.fn().mockResolvedValue({ data: { user: null } }),
  mockSingle: vi.fn().mockResolvedValue({ data: { id: 'c1', title: 'Curso', price_eur: 199 }, error: null }),
}))
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockSingle }),
  }),
}))

import ComprarPage from '@/app/curso-bachatango/comprar/page'
beforeEach(() => vi.clearAllMocks())

describe('/curso-bachatango/comprar', () => {
  it('notFound sin courseId', async () => {
    await expect(ComprarPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND')
  })
  it('renderiza el título del curso y el form', async () => {
    const el = await ComprarPage({ searchParams: Promise.resolve({ courseId: 'c1' }) })
    expect(JSON.stringify(el)).toContain('Curso')
  })
  it('re-echoa los campos desde la cookie flash tras un error de validación', async () => {
    mockCookieGet.mockReturnValueOnce({
      value: JSON.stringify({ name: 'Ana', email: 'ana@example.com', city: 'Madrid' }),
    })
    const el = await ComprarPage({ searchParams: Promise.resolve({ courseId: 'c1', error: 'city' }) })
    const html = JSON.stringify(el)
    expect(html).toContain('ana@example.com')
    expect(html).toContain('Madrid')
  })
  it('cookie flash corrupta → formulario vacío, sin crash', async () => {
    mockCookieGet.mockReturnValueOnce({ value: '{not json' })
    const el = await ComprarPage({ searchParams: Promise.resolve({ courseId: 'c1' }) })
    expect(el).toBeTruthy()
  })
})
