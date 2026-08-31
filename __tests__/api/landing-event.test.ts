import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const insertMock = vi.fn()
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({ from: () => ({ insert: insertMock }) }),
}))

vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
}))

vi.mock('@/utils/auth/client-ip', () => ({ getClientIp: () => '1.2.3.4' }))

const demoMock = vi.fn(() => false)
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => demoMock() }))

import { POST } from '@/app/api/landing-event/route'

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

function req(body: unknown, ua: string = BROWSER_UA): Request {
  return new Request('http://localhost/api/landing-event', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': ua },
    body: JSON.stringify(body),
  })
}

describe('POST /api/landing-event', () => {
  beforeEach(() => {
    insertMock.mockReset().mockResolvedValue({ error: null })
    demoMock.mockReturnValue(false)
    process.env.LANDING_ANALYTICS_SECRET = 'test-secret'
  })

  it('guarda una ruta medida y responde 204', async () => {
    const res = await POST(req({ path: '/curso-bachatango' }))
    expect(res.status).toBe(204)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/curso-bachatango', visitor_hash: expect.any(String) }),
    )
  })

  it('normaliza la ruta antes de guardarla', async () => {
    await POST(req({ path: '/curso-bachatango?utm_source=ig' }))
    expect(insertMock.mock.calls[0][0].path).toBe('/curso-bachatango')
  })

  it('nunca guarda la IP ni el user-agent', async () => {
    await POST(req({ path: '/' }))
    const row = JSON.stringify(insertMock.mock.calls[0][0])
    expect(row).not.toContain('1.2.3.4')
    expect(row).not.toContain('Mozilla')
  })

  it('descarta rutas no permitidas sin tocar la BD', async () => {
    const res = await POST(req({ path: '/admin' }))
    expect(res.status).toBe(204)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('descarta cuerpos malformados', async () => {
    for (const body of [{}, { path: 42 }, { otra: 'cosa' }]) {
      await POST(req(body))
    }
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('descarta JSON inválido sin lanzar', async () => {
    const bad = new Request('http://localhost/api/landing-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': BROWSER_UA },
      body: 'no-es-json',
    })
    const res = await POST(bad)
    expect(res.status).toBe(204)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('descarta bots', async () => {
    const res = await POST(req({ path: '/' }, 'Mozilla/5.0 (compatible; Googlebot/2.1)'))
    expect(res.status).toBe(204)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('fail-closed sin secreto', async () => {
    delete process.env.LANDING_ANALYTICS_SECRET
    const res = await POST(req({ path: '/' }))
    expect(res.status).toBe(204)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('respeta el limitador', async () => {
    const { rateLimit } = await import('@/utils/rate-limit')
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 60 })
    const res = await POST(req({ path: '/' }))
    expect(res.status).toBe(204)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('no registra nada en local ni en preview', async () => {
    demoMock.mockReturnValue(true)
    const res = await POST(req({ path: '/curso-bachatango' }))
    expect(res.status).toBe(204)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('responde 204 aunque la BD falle: la analítica no rompe la navegación', async () => {
    insertMock.mockResolvedValue({ error: { message: 'boom' } })
    const res = await POST(req({ path: '/' }))
    expect(res.status).toBe(204)
  })
})
