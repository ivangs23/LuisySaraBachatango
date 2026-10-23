import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { makeFreeClassesToken, verifyFreeClassesToken } from '@/utils/newsletter/free-classes-token'
import { makeUnsubscribeToken } from '@/utils/newsletter/unsubscribe-token'

describe('token de la página de clases extra', () => {
  beforeEach(() => { vi.stubEnv('NEWSLETTER_UNSUBSCRIBE_SECRET', 'secreto-de-prueba') })
  afterEach(() => { vi.unstubAllEnvs() })

  it('verifica el token de su propio email', () => {
    const t = makeFreeClassesToken('ana@example.com')!
    expect(verifyFreeClassesToken('ana@example.com', t)).toBe(true)
  })

  it('normaliza mayúsculas y espacios del email', () => {
    const t = makeFreeClassesToken('Ana@Example.com ')!
    expect(verifyFreeClassesToken('ana@example.com', t)).toBe(true)
  })

  it('rechaza el token de otro email (email manipulado en la URL)', () => {
    const t = makeFreeClassesToken('ana@example.com')!
    expect(verifyFreeClassesToken('otra@example.com', t)).toBe(false)
  })

  it('rechaza tokens vacíos, cortos o inventados', () => {
    expect(verifyFreeClassesToken('ana@example.com', '')).toBe(false)
    expect(verifyFreeClassesToken('ana@example.com', 'abc')).toBe(false)
    expect(verifyFreeClassesToken('ana@example.com', 'f'.repeat(64))).toBe(false)
  })

  // El enlace de las clases se reenvía y se comparte más que uno de baja. Si
  // fueran el mismo HMAC, quien recibiera el enlace reenviado podría dar de
  // baja a esa persona.
  it('no coincide con el token de baja del mismo email', () => {
    const email = 'ana@example.com'
    expect(makeFreeClassesToken(email)).not.toBe(makeUnsubscribeToken(email))
    expect(verifyFreeClassesToken(email, makeUnsubscribeToken(email)!)).toBe(false)
  })

  it('sin secreto no firma ni acepta nada (fail-closed)', () => {
    vi.stubEnv('NEWSLETTER_UNSUBSCRIBE_SECRET', '')
    expect(makeFreeClassesToken('ana@example.com')).toBeNull()
    expect(verifyFreeClassesToken('ana@example.com', 'f'.repeat(64))).toBe(false)
  })
})
