import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const upsertMock = vi.fn()
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({ from: () => ({ upsert: upsertMock }) }),
}))

vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
}))

vi.mock('@/utils/auth/client-ip', () => ({ getClientIp: () => '1.2.3.4' }))

const demoMock = vi.fn(() => false)
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => demoMock() }))

import { POST } from '@/app/api/presence/route'

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

function req(ua: string = BROWSER_UA): Request {
  return new Request('http://localhost/api/presence', {
    method: 'POST',
    headers: { 'user-agent': ua },
  })
}

describe('POST /api/presence', () => {
  beforeEach(() => {
    upsertMock.mockReset().mockResolvedValue({ error: null })
    demoMock.mockReturnValue(false)
    process.env.LANDING_ANALYTICS_SECRET = 'test-secret'
  })

  it('registra el latido y responde 204', async () => {
    const res = await POST(req())
    expect(res.status).toBe(204)
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ visitor_hash: expect.any(String), last_seen: expect.any(String) }),
      { onConflict: 'visitor_hash' },
    )
  })

  it('solo guarda el hash y la hora: ni IP, ni user-agent, ni ruta', async () => {
    await POST(req())
    const row = upsertMock.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(row).sort()).toEqual(['last_seen', 'visitor_hash'])
    const serialised = JSON.stringify(row)
    expect(serialised).not.toContain('1.2.3.4')
    expect(serialised).not.toContain('Mozilla')
  })

  it('el mismo visitante actualiza su fila en vez de crear otra', async () => {
    await POST(req())
    await POST(req())
    const first = upsertMock.mock.calls[0][0] as { visitor_hash: string }
    const second = upsertMock.mock.calls[1][0] as { visitor_hash: string }
    expect(second.visitor_hash).toBe(first.visitor_hash)
  })

  it('descarta bots', async () => {
    const res = await POST(req('Mozilla/5.0 (compatible; Googlebot/2.1)'))
    expect(res.status).toBe(204)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('fail-closed sin secreto', async () => {
    delete process.env.LANDING_ANALYTICS_SECRET
    const res = await POST(req())
    expect(res.status).toBe(204)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('respeta el limitador', async () => {
    const { rateLimit } = await import('@/utils/rate-limit')
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 60 })
    const res = await POST(req())
    expect(res.status).toBe(204)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('no registra nada en local ni en preview', async () => {
    demoMock.mockReturnValue(true)
    const res = await POST(req())
    expect(res.status).toBe(204)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('responde 204 aunque la BD falle: el latido no rompe la navegación', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'boom' } })
    const res = await POST(req())
    expect(res.status).toBe(204)
  })
})
