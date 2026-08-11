import { describe, it, expect } from 'vitest'
import {
  CONSENT_COOKIE,
  CONSENT_VERSION,
  parseConsent,
  serializeConsent,
  makeConsent,
} from '@/utils/consent/categories'

describe('consent state', () => {
  it('el nombre de cookie es estable', () => {
    expect(CONSENT_COOKIE).toBe('ls_consent')
  })

  it('makeConsent sella versión y fecha', () => {
    const s = makeConsent(true, false, new Date('2026-08-11T10:00:00Z'))
    expect(s).toEqual({
      v: CONSENT_VERSION,
      analytics: true,
      marketing: false,
      at: '2026-08-11T10:00:00.000Z',
    })
  })

  it('serializar y parsear es un round-trip', () => {
    const s = makeConsent(true, true, new Date('2026-08-11T10:00:00Z'))
    expect(parseConsent(serializeConsent(s))).toEqual(s)
  })

  it('devuelve null con entrada vacía', () => {
    expect(parseConsent(null)).toBeNull()
    expect(parseConsent(undefined)).toBeNull()
    expect(parseConsent('')).toBeNull()
  })

  it('devuelve null con JSON corrupto', () => {
    expect(parseConsent('no-es-json')).toBeNull()
    expect(parseConsent('%7Broto')).toBeNull()
  })

  it('devuelve null si la versión no coincide (re-preguntar)', () => {
    const stale = encodeURIComponent(JSON.stringify({ v: 0, analytics: true, marketing: true, at: 'x' }))
    expect(parseConsent(stale)).toBeNull()
  })

  it('devuelve null si faltan campos booleanos', () => {
    const bad = encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION, analytics: 'yes', at: 'x' }))
    expect(parseConsent(bad)).toBeNull()
  })

  it('devuelve null si el payload no es un objeto', () => {
    expect(parseConsent(encodeURIComponent(JSON.stringify('cadena')))).toBeNull()
    expect(parseConsent(encodeURIComponent(JSON.stringify(null)))).toBeNull()
  })
})
