import { describe, it, expect } from 'vitest'
import { validateRegistration } from '@/utils/checkout/registration-validation'

const base = {
  fullName: 'Ana Ruiz', email: 'ana@example.com',
  password: 'Bachata2026', repeatPassword: 'Bachata2026',
  country: 'ES', city: 'Madrid', postalCode: '28001', dateOfBirth: '1995-05-20',
  danceLevel: 'principiante', phone: '', marketingConsent: '', acceptTerms: 'on',
}
const r = (o: Partial<typeof base>) => validateRegistration({ ...base, ...o })

describe('validateRegistration', () => {
  it('accepts a valid payload and returns cleaned data', () => {
    const out = r({})
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.email).toBe('ana@example.com')
      expect(out.data.marketingConsent).toBe(false)
      expect(out.data.phone).toBe(null)
      expect('repeatPassword' in out.data).toBe(false)
    }
  })
  it('lowercases/trims email', () => {
    const out = r({ email: '  Ana@Example.COM ' })
    expect(out.ok && out.data.email).toBe('ana@example.com')
  })
  it('rejects invalid email', () => { expect(r({ email: 'nope' })).toEqual({ ok: false, code: 'invalid_email' }) })
  it('rejects short password', () => { expect(r({ password: 'Ab1', repeatPassword: 'Ab1' })).toEqual({ ok: false, code: 'password_too_short' }) })
  it('rejects weak password (no uppercase/number)', () => {
    expect(r({ password: 'bachatabaila', repeatPassword: 'bachatabaila' })).toEqual({ ok: false, code: 'password_weak' })
  })
  it('rejects mismatched repeat', () => { expect(r({ repeatPassword: 'Different1' })).toEqual({ ok: false, code: 'password_mismatch' }) })
  it('rejects invalid country', () => { expect(r({ country: 'ZZ' })).toEqual({ ok: false, code: 'invalid_country' }) })
  it('rejects missing city', () => { expect(r({ city: '' })).toEqual({ ok: false, code: 'missing' }) })
  it('rejects missing / invalid postal code', () => {
    expect(r({ postalCode: '' })).toEqual({ ok: false, code: 'invalid_postal' })
    expect(r({ postalCode: '!' })).toEqual({ ok: false, code: 'invalid_postal' })
    expect(r({ postalCode: 'x'.repeat(12) })).toEqual({ ok: false, code: 'invalid_postal' })
  })
  it('accepts ES and UK postal formats', () => {
    expect(r({ postalCode: '28001' }).ok).toBe(true)
    expect(r({ postalCode: 'SW1A 1AA' }).ok).toBe(true)
  })
  it('rejects too-young / future / too-old birthdate', () => {
    expect(r({ dateOfBirth: '2020-01-01' })).toEqual({ ok: false, code: 'invalid_birthdate' })
    expect(r({ dateOfBirth: '2999-01-01' })).toEqual({ ok: false, code: 'invalid_birthdate' })
    expect(r({ dateOfBirth: '1900-01-01' })).toEqual({ ok: false, code: 'invalid_birthdate' })
  })
  it('rejects invalid dance level', () => { expect(r({ danceLevel: 'pro' })).toEqual({ ok: false, code: 'missing' }) })
  it('requires accepted terms', () => { expect(r({ acceptTerms: '' })).toEqual({ ok: false, code: 'terms_not_accepted' }) })
  it('rejects malformed phone when present', () => { expect(r({ phone: 'abc' })).toEqual({ ok: false, code: 'invalid_phone' }) })
  it('accepts a valid phone', () => {
    const out = r({ phone: '+34 600 123 456' })
    expect(out.ok && out.data.phone).toBe('+34 600 123 456')
  })
  it('maps marketing checkbox on -> true', () => {
    const out = r({ marketingConsent: 'on' })
    expect(out.ok && out.data.marketingConsent).toBe(true)
  })
  it('rejects malformed / non-ISO / impossible birthdates', () => {
    for (const dob of ['1995', '1995-05', '2020-02-30', '1995/05/20', 'not-a-date', '1995-13-01']) {
      expect(r({ dateOfBirth: dob })).toEqual({ ok: false, code: 'invalid_birthdate' })
    }
  })
})
