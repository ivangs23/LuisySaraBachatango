import { describe, it, expect, vi, beforeEach } from 'vitest'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_API_KEY = 're_test'
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'e1' }) })
})

import { sendPurchaseConfirmation } from '@/utils/email/purchase-confirmation'

describe('sendPurchaseConfirmation', () => {
  it('new account: posts to Resend with the access copy', async () => {
    await sendPurchaseConfirmation({ email: 'ana@example.com', fullName: 'Ana', existingAccount: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const body = JSON.parse(init.body)
    expect(body.to).toEqual(['ana@example.com'])
    expect(body.from).toContain('noreply@luisysarabachatango.com')
    expect(body.html).toMatch(/contrase/i)
  })
  it('existing account: uses the "entra con tu cuenta" copy', async () => {
    await sendPurchaseConfirmation({ email: 'ana@example.com', fullName: null, existingAccount: true })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.html).toMatch(/cuenta/i)
  })
  it('never throws when Resend fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })
    await expect(sendPurchaseConfirmation({ email: 'a@b.com', fullName: 'A', existingAccount: false })).resolves.toBeUndefined()
  })
  it('no-op without RESEND_API_KEY', async () => {
    delete process.env.RESEND_API_KEY
    await sendPurchaseConfirmation({ email: 'a@b.com', fullName: 'A', existingAccount: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('never throws when fetch itself rejects (network error)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    await expect(sendPurchaseConfirmation({ email: 'a@b.com', fullName: 'A', existingAccount: false })).resolves.toBeUndefined()
  })
})
