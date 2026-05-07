import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ update: updateMock }) }),
}))

const SECRET = 'test-secret'
process.env.MUX_WEBHOOK_SECRET = SECRET
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://t.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc'

import { POST } from '@/app/api/webhooks/mux/route'

function signedRequest(payload: object): Request {
  const body = JSON.stringify(payload)
  const t = Math.floor(Date.now() / 1000).toString()
  const sig = crypto.createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')
  return new Request('http://x/webhook', {
    method: 'POST',
    headers: { 'mux-signature': `t=${t},v1=${sig}` },
    body,
  })
}

describe('Mux webhook', () => {
  beforeEach(() => {
    updateMock.mockClear()
    updateMock.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  })

  it('rejects unsigned request', async () => {
    const res = await POST(new Request('http://x', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('rejects invalid signature', async () => {
    const res = await POST(new Request('http://x', {
      method: 'POST',
      headers: { 'mux-signature': 't=1,v1=00' },
      body: '{}',
    }))
    expect(res.status).toBe(401)
  })

  it('updates lesson on asset.ready', async () => {
    const res = await POST(signedRequest({
      type: 'video.asset.ready',
      data: { id: 'asset-1', playback_ids: [{ id: 'pb-1' }] },
    }))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ mux_status: 'ready', mux_playback_id: 'pb-1' })
  })

  it('updates lesson on asset.errored', async () => {
    const res = await POST(signedRequest({
      type: 'video.asset.errored',
      data: { id: 'asset-1' },
    }))
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ mux_status: 'errored' })
  })

  it('returns 200 (and does nothing) for unknown event types', async () => {
    const res = await POST(signedRequest({ type: 'video.asset.created', data: { id: 'a' } }))
    expect(res.status).toBe(200)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('returns 500 when MUX_WEBHOOK_SECRET is missing', async () => {
    delete process.env.MUX_WEBHOOK_SECRET
    const res = await POST(new Request('http://x', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(500)
    process.env.MUX_WEBHOOK_SECRET = SECRET // restore
  })
})
