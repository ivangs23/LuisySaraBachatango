import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockLt, mockDelete } = vi.hoisted(() => ({ mockLt: vi.fn().mockResolvedValue({ error: null, count: 3 }), mockDelete: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: () => ({ delete: () => { mockDelete(); return { lt: (_c: string, v: string) => mockLt(v) } } }),
  }),
}))

import { GET } from '@/app/api/cron/purge-pending/route'
beforeEach(() => { vi.clearAllMocks(); process.env.CRON_SECRET = 'secret123' })
const req = (auth?: string) => new Request('http://x/api/cron/purge-pending', { headers: auth ? { authorization: auth } : {} })

describe('GET /api/cron/purge-pending', () => {
  it('401 without the correct bearer', async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('Bearer wrong'))).status).toBe(401)
    expect(mockDelete).not.toHaveBeenCalled()
  })
  it('401 when CRON_SECRET is unset, even with "Bearer undefined"', async () => {
    delete process.env.CRON_SECRET
    expect((await GET(req('Bearer undefined'))).status).toBe(401)
    expect((await GET(req('Bearer '))).status).toBe(401)
    expect(mockDelete).not.toHaveBeenCalled()
  })
  it('401 when CRON_SECRET is empty string', async () => {
    process.env.CRON_SECRET = ''
    expect((await GET(req('Bearer '))).status).toBe(401)
    expect(mockDelete).not.toHaveBeenCalled()
  })
  it('authorized: deletes rows older than the TTL', async () => {
    const res = await GET(req('Bearer secret123'))
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalled()
    const cutoff = mockLt.mock.calls[0][0]
    expect(typeof cutoff).toBe('string')
    expect(Number.isNaN(Date.parse(cutoff))).toBe(false)
  })
})
