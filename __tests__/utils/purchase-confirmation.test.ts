import { describe, it, expect, vi, beforeEach } from 'vitest'

// `utils/email/*` está marcado `server-only`, que lanza fuera de un Server
// Component. Se neutraliza igual que en el resto de la suite.
vi.mock('server-only', () => ({}))

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
  it('sends a plain-text alternative alongside the HTML', async () => {
    // Un correo sin text/plain puntúa peor en los filtros antispam y es lo
    // único que ven los clientes que bloquean HTML.
    await sendPurchaseConfirmation({ email: 'ana@example.com', fullName: 'Ana', existingAccount: false })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(typeof body.text).toBe('string')
    expect(body.text.length).toBeGreaterThan(80)
    expect(body.text).not.toMatch(/<[a-z]/i)          // sin etiquetas sueltas
    expect(body.text).toMatch(/https?:\/\//)          // los enlaces sobreviven
  })
  it('carries the brand header and a preheader', async () => {
    await sendPurchaseConfirmation({ email: 'ana@example.com', fullName: 'Ana', existingAccount: false })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.html).toContain('/icon.png')           // el logo real
    expect(body.html).toMatch(/alt="[^"]+"/)           // con texto alternativo
    // La línea de vista previa de la bandeja va oculta en el cuerpo.
    expect(body.html).toMatch(/max-height:0;overflow:hidden/)
  })
  it('points the logo at the public domain even if BASE_URL is a dev origin', async () => {
    // Un cliente de correo no tiene localhost: si el logo colgara de
    // NEXT_PUBLIC_BASE_URL y ese valor apuntara a desarrollo, la imagen se
    // rompería en la bandeja de todos los compradores sin aviso. Pasó en una
    // prueba real, así que se fija aquí.
    vi.resetModules()
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
    const { sendPurchaseConfirmation: fresco } = await import('@/utils/email/purchase-confirmation')
    await fresco({ email: 'ana@example.com', fullName: 'Ana', existingAccount: false })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const src = body.html.match(/<img src="([^"]+)"/)?.[1]
    expect(src).toBe('https://luisysarabachatango.com/icon.png')
    expect(src).not.toContain('localhost')
    delete process.env.NEXT_PUBLIC_BASE_URL
  })
  it('identifies the sender in the footer, as commercial email requires', async () => {
    await sendPurchaseConfirmation({ email: 'ana@example.com', fullName: 'Ana', existingAccount: false })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.html).toContain('LS ESCUELA DE BAILES')
    expect(body.html).toContain('E09928052')
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
