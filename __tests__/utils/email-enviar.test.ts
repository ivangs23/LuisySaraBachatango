import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/utils/alerta', () => ({ alertaCritica: vi.fn() }))

import { enviar } from '@/utils/email/layout'

const fetchMock = vi.fn()
const BASE = { to: 'ana@example.com', subject: 'Hola', html: '<p>Hola</p>', text: 'Hola', etiqueta: 'test' }

describe('enviar', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset().mockResolvedValue({ ok: true, text: async () => '' })
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  // El motor de secuencias necesita saberlo: si el envío falla, borra la fila
  // de `email_sends` para que la próxima ejecución lo reintente.
  it('devuelve true si Resend acepta el correo', async () => {
    expect(await enviar(BASE)).toBe(true)
  })

  it('devuelve false si Resend lo rechaza', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, text: async () => 'bad' })
    expect(await enviar(BASE)).toBe(false)
  })

  it('devuelve false si la red falla, sin lanzar', async () => {
    fetchMock.mockRejectedValue(new Error('red'))
    expect(await enviar(BASE)).toBe(false)
  })

  it('devuelve false sin RESEND_API_KEY y no llama a nadie', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    expect(await enviar(BASE)).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('manda reply_to solo si se le pide', async () => {
    await enviar({ ...BASE, replyTo: 'hola@example.com' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reply_to).toBe('hola@example.com')

    await enviar(BASE)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('reply_to')
  })
})
