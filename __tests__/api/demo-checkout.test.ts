import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/demo/mode', () => {
  const mockIsDemoMode = vi.fn()
  return { isDemoMode: mockIsDemoMode }
})

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
}))

vi.mock('@/utils/supabase/server', () => {
  const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } })
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'c1', title: 'Curso', price_eur: 199 }, error: null })
  return {
    createClient: vi.fn().mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockSingle }),
    }),
  }
})

import DemoCheckoutPage from '@/app/demo-checkout/page'
import { isDemoMode } from '@/utils/demo/mode'

beforeEach(() => vi.clearAllMocks())

describe('/demo-checkout', () => {
  it('notFound cuando NO es modo demo', async () => {
    vi.mocked(isDemoMode).mockReturnValue(false)
    await expect(DemoCheckoutPage({ searchParams: Promise.resolve({ courseId: 'c1' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('en demo, renderiza (muestra el título del curso)', async () => {
    vi.mocked(isDemoMode).mockReturnValue(true)
    const el = await DemoCheckoutPage({ searchParams: Promise.resolve({ courseId: 'c1' }) })
    expect(JSON.stringify(el)).toContain('Curso')
  })
})
