import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/utils/alerta', () => ({ alertaCritica: vi.fn() }))

import { sendFreeClassesEmail } from '@/utils/email/free-classes'
import { verifyFreeClassesToken } from '@/utils/newsletter/free-classes-token'
import { ENTITY } from '@/utils/legal/entity'

const fetchMock = vi.fn()

function cuerpo() {
  return JSON.parse(fetchMock.mock.calls[0][1].body) as {
    to: string[]; subject: string; html: string; text: string; reply_to?: string; headers?: Record<string, string>
  }
}

describe('sendFreeClassesEmail (paso 1 de la secuencia)', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('NEWSLETTER_UNSUBSCRIBE_SECRET', 'secreto-de-prueba')
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://luisysarabachatango.com')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset().mockResolvedValue({ ok: true, text: async () => '' })
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('manda «Tus dos clases de bachatango» a quien se apuntó', async () => {
    expect(await sendFreeClassesEmail('ana@example.com')).toBe(true)
    expect(cuerpo().to).toEqual(['ana@example.com'])
    expect(cuerpo().subject).toBe('Tus dos clases de bachatango')
  })

  it('el botón lleva a la página privada con un token válido para ese email', async () => {
    await sendFreeClassesEmail('ana@example.com')
    const m = cuerpo().text.match(/https:\/\/luisysarabachatango\.com\/clase-gratis\/mas\?e=([^&\s]+)&t=([0-9a-f]+)/)
    expect(m).not.toBeNull()
    expect(decodeURIComponent(m![1])).toBe('ana@example.com')
    expect(verifyFreeClassesToken('ana@example.com', m![2])).toBe(true)
  })

  // Comunicación comercial: enlace de baja visible y cabecera para el botón
  // de baja de Gmail y Outlook (LSSI art. 21, RFC 8058).
  it('lleva enlace de baja y List-Unsubscribe', async () => {
    await sendFreeClassesEmail('ana@example.com')
    const b = cuerpo()
    expect(b.html).toContain('/unsubscribe?email=ana%40example.com')
    expect(b.text).toContain('/unsubscribe?email=ana%40example.com')
    expect(b.headers?.['List-Unsubscribe']).toContain('/unsubscribe?email=ana%40example.com')
    expect(b.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('las respuestas van al email de contacto, no al noreply', async () => {
    await sendFreeClassesEmail('ana@example.com')
    expect(cuerpo().reply_to).toBe(ENTITY.email)
  })

  it('sin secreto no envía: no podría llevar enlace de baja', async () => {
    vi.stubEnv('NEWSLETTER_UNSUBSCRIBE_SECRET', '')
    expect(await sendFreeClassesEmail('ana@example.com')).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('devuelve false si Resend lo rechaza', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => '' })
    expect(await sendFreeClassesEmail('ana@example.com')).toBe(false)
  })
})
