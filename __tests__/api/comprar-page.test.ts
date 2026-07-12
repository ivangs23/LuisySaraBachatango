import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNotFound = vi.fn(() => { throw new Error('NOT_FOUND') })
vi.mock('next/navigation', () => ({ notFound: () => mockNotFound() }))
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
})
