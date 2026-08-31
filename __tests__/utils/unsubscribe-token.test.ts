import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))

import { makeUnsubscribeToken, verifyUnsubscribeToken } from '@/utils/newsletter/unsubscribe-token'

const OLD = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET

describe('unsubscribe token', () => {
  beforeEach(() => { process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'test-secret' })
  afterEach(() => { process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = OLD })

  it('un token recién creado se verifica', () => {
    const tok = makeUnsubscribeToken('a@b.com')!
    expect(verifyUnsubscribeToken('a@b.com', tok)).toBe(true)
  })

  it('el token de un email no sirve para otro', () => {
    const tok = makeUnsubscribeToken('a@b.com')!
    expect(verifyUnsubscribeToken('otro@b.com', tok)).toBe(false)
  })

  it('rechaza un token manipulado', () => {
    expect(verifyUnsubscribeToken('a@b.com', 'deadbeef')).toBe(false)
  })

  it('rechaza un token vacío', () => {
    expect(verifyUnsubscribeToken('a@b.com', '')).toBe(false)
  })

  it('normaliza el email antes de firmar', () => {
    const tok = makeUnsubscribeToken('A@B.com')!
    expect(verifyUnsubscribeToken('a@b.com', tok)).toBe(true)
    expect(verifyUnsubscribeToken('  A@B.COM  ', tok)).toBe(true)
  })

  it('fail-closed sin secreto configurado', () => {
    delete process.env.NEWSLETTER_UNSUBSCRIBE_SECRET
    expect(makeUnsubscribeToken('a@b.com')).toBeNull()
    expect(verifyUnsubscribeToken('a@b.com', 'cualquiera')).toBe(false)
  })

  it('cambiar el secreto invalida los tokens antiguos', () => {
    const tok = makeUnsubscribeToken('a@b.com')!
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'otro-secreto'
    expect(verifyUnsubscribeToken('a@b.com', tok)).toBe(false)
  })
})
