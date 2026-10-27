import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_API_KEY = 're_test'
  vi.stubGlobal('fetch', fetchMock)
})

import { listSentEmails, parseResendDate } from '@/utils/email/resend-log'

const correo = (id: string, created_at: string, extra: Record<string, unknown> = {}) => ({
  id, to: ['Ana@Example.com'], subject: 'Asunto', created_at, last_event: 'delivered', ...extra,
})
const pagina = (data: unknown[], has_more: boolean) => ({ ok: true, status: 200, json: async () => ({ object: 'list', data, has_more }) })
const fallo = (status: number, body: unknown) => ({ ok: false, status, json: async () => body })

describe('parseResendDate', () => {
  it('entiende el formato de Resend (espacio, microsegundos, zona sin minutos)', () => {
    expect(parseResendDate('2026-10-23 09:55:33.922000+00')).toBe(Date.parse('2026-10-23T09:55:33.922Z'))
  })
})

describe('listSentEmails', () => {
  it('sin clave no llama a Resend', async () => {
    delete process.env.RESEND_API_KEY
    expect(await listSentEmails(0)).toEqual({ ok: false, reason: 'sin-clave' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normaliza los destinatarios a minúsculas y las fechas a milisegundos', async () => {
    fetchMock.mockResolvedValueOnce(pagina([correo('a', '2026-10-23 09:55:33.922000+00')], false))
    const r = await listSentEmails(0)
    expect(r).toEqual({ ok: true, emails: [{
      id: 'a', to: ['ana@example.com'], subject: 'Asunto', createdAt: Date.parse('2026-10-23T09:55:33.922Z'), lastEvent: 'delivered',
    }] })
  })

  it('pasa de página con `after` hasta llegar a correos anteriores a la fecha pedida', async () => {
    fetchMock
      .mockResolvedValueOnce(pagina([correo('c', '2026-10-25 10:00:00+00'), correo('b', '2026-10-24 10:00:00+00')], true))
      .mockResolvedValueOnce(pagina([correo('a', '2026-10-01 10:00:00+00')], true))
    const r = await listSentEmails(Date.parse('2026-10-20T00:00:00Z'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toContain('after=b')
    // El de antes de la fecha se descarta aunque viniera en la página.
    expect(r.ok && r.emails.map((e) => e.id)).toEqual(['c', 'b'])
  })

  it('para cuando Resend dice que no hay más', async () => {
    fetchMock.mockResolvedValueOnce(pagina([correo('a', '2026-10-25 10:00:00+00')], false))
    await listSentEmails(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('una clave que Resend rechaza es `clave-invalida`: tampoco sale ningún correo', async () => {
    // Respuesta real de Resend a una clave borrada o mal copiada.
    fetchMock.mockResolvedValueOnce(fallo(400, { statusCode: 400, message: 'API key is invalid', name: 'validation_error' }))
    expect(await listSentEmails(0)).toEqual({ ok: false, reason: 'clave-invalida' })
  })

  it('una clave de solo envío es `sin-permiso`', async () => {
    fetchMock.mockResolvedValueOnce(fallo(401, { name: 'restricted_api_key', message: 'This API key is restricted to only send emails' }))
    expect(await listSentEmails(0)).toEqual({ ok: false, reason: 'sin-permiso' })
  })

  it('otro fallo de Resend es `error`', async () => {
    fetchMock.mockResolvedValueOnce(fallo(500, { message: 'boom' }))
    expect(await listSentEmails(0)).toEqual({ ok: false, reason: 'error' })
  })

  it('nunca lanza si la red falla', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await expect(listSentEmails(0)).resolves.toEqual({ ok: false, reason: 'error' })
  })
})
