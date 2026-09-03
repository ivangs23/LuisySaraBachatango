import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const verifyOtp = vi.fn()
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}))

const avisoAuth = vi.fn()
vi.mock('@/utils/alerta', () => ({ avisoAuth: (...a: unknown[]) => avisoAuth(...a) }))

import { GET } from '@/app/auth/confirm/route'

const ORIGIN = 'https://luisysarabachatango.com'

function req(query: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/auth/confirm${query}`, { headers })
}

function location(res: Response): string {
  return res.headers.get('location') ?? ''
}

beforeEach(() => {
  verifyOtp.mockReset().mockResolvedValue({ error: null })
  avisoAuth.mockReset()
})

describe('GET /auth/confirm', () => {
  it('canjea el token_hash con verifyOtp', async () => {
    await GET(req('?token_hash=abc123&type=recovery&next=/reset-password'))
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'abc123' })
  })

  /**
   * El motivo de existir de esta ruta. `verifyOtp` en servidor fija la cookie de
   * sesión sin `code_verifier`, así que el enlace funciona aunque se pida en un
   * dispositivo y se abra en otro — que es como falló el reset en producción.
   */
  it('lleva al destino pedido cuando el canje va bien', async () => {
    const res = await GET(req('?token_hash=abc123&type=recovery&next=/reset-password'))
    expect(location(res)).toBe(`${ORIGIN}/reset-password`)
  })

  it('nunca arrastra el token al destino', async () => {
    const res = await GET(req('?token_hash=secreto-abc123&type=recovery&next=/reset-password'))
    expect(location(res)).not.toContain('secreto-abc123')
    expect(location(res)).not.toContain('token_hash')
  })

  it('ignora un next que no esté en la allowlist', async () => {
    const res = await GET(req('?token_hash=abc123&type=recovery&next=//evil.com'))
    expect(location(res)).toBe(`${ORIGIN}/`)
  })

  it('acepta los tipos de enlace por email que usa la app', async () => {
    for (const type of ['recovery', 'invite', 'signup', 'magiclink', 'email_change']) {
      verifyOtp.mockClear()
      await GET(req(`?token_hash=abc123&type=${type}`))
      expect(verifyOtp).toHaveBeenCalledWith({ type, token_hash: 'abc123' })
    }
  })

  /**
   * `email` es el valor que usa la propia documentación de Supabase en su
   * plantilla de Confirm signup y en la de Magic link. Sin él, migrar el alta a
   * esta ruta —copiando la línea de los docs— mandaría cada confirmación a la
   * página de error.
   */
  it("acepta 'email', el tipo de la documentación de Supabase", async () => {
    await GET(req('?token_hash=abc123&type=email'))
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'email', token_hash: 'abc123' })
  })

  it('rechaza un type inventado sin llamar a Supabase', async () => {
    const res = await GET(req('?token_hash=abc123&type=cualquier_cosa'))
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(location(res)).toBe(`${ORIGIN}/auth/auth-code-error`)
  })

  it('sin token_hash no toca Supabase', async () => {
    const res = await GET(req('?type=recovery'))
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(location(res)).toBe(`${ORIGIN}/auth/auth-code-error`)
  })

  /**
   * Aquí acababa el 404: el callback mandaba a /auth/auth-code-error y esa
   * página no existía. Ahora existe, así que un enlace caducado explica qué
   * pasó en vez de parecer que la web está rota.
   */
  it('manda a la página de error cuando el token es inválido o ha caducado', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired' } })
    const res = await GET(req('?token_hash=caducado&type=recovery&next=/reset-password'))
    expect(location(res)).toBe(`${ORIGIN}/auth/auth-code-error`)
  })

  /**
   * El fallo del reset vivió meses porque nadie podía verlo: los dos routes de
   * auth se tragaban el error y Sentry no recibía nada. Sin esto, la próxima
   * vez que un enlace deje de funcionar tampoco se enteraría nadie.
   */
  it('avisa a Sentry cuando el canje falla, con el código y sin el token', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired', code: 'otp_expired', status: 403 } })
    await GET(req('?token_hash=secreto-abc123&type=recovery&next=/reset-password'))

    expect(avisoAuth).toHaveBeenCalledTimes(1)
    const [mensaje, contexto] = avisoAuth.mock.calls[0] as [string, Record<string, unknown>]
    expect(mensaje).toMatch(/confirm/i)
    expect(contexto).toMatchObject({ tipo: 'recovery', codigo: 'otp_expired' })
    expect(JSON.stringify(contexto)).not.toContain('secreto-abc123')
  })

  it('avisa también cuando faltan parámetros o el type es inválido', async () => {
    await GET(req('?type=recovery'))
    expect(avisoAuth).toHaveBeenCalledTimes(1)

    avisoAuth.mockReset()
    await GET(req('?token_hash=abc123&type=inventado'))
    expect(avisoAuth).toHaveBeenCalledTimes(1)
  })

  it('no avisa cuando el canje va bien', async () => {
    await GET(req('?token_hash=abc123&type=recovery&next=/reset-password'))
    expect(avisoAuth).not.toHaveBeenCalled()
  })

  it('respeta el host público detrás del proxy', async () => {
    const res = await GET(
      req('?token_hash=abc123&type=recovery&next=/reset-password', {
        'x-forwarded-host': 'luisysarabachatango.com',
      }),
    )
    expect(location(res)).toBe('https://luisysarabachatango.com/reset-password')
  })
})
