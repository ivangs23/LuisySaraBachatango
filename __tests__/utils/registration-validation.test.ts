import { describe, it, expect } from 'vitest'
import { validateRegistration } from '@/utils/checkout/registration-validation'

describe('validateRegistration — formulario mínimo', () => {
  const base = {
    fullName: 'Ana García', email: 'ana@example.com',
    acceptTerms: 'on', acceptDigitalExecution: 'on', isAdult: 'on',
  }

  it('acepta el formulario mínimo: nombre, email y las tres casillas', () => {
    const r = validateRegistration(base)
    expect(r).toEqual({
      ok: true,
      data: { fullName: 'Ana García', email: 'ana@example.com', marketingConsent: false, acceptDigitalExecution: true },
    })
  })

  it('ya no pide contraseña ni los campos que nadie leía', () => {
    const r = validateRegistration(base)
    expect(r.ok).toBe(true)
    expect(Object.keys((r as { data: object }).data).sort())
      .toEqual(['acceptDigitalExecution', 'email', 'fullName', 'marketingConsent'])
  })

  it('exige la casilla de edad: las condiciones piden 16 años', () => {
    expect(validateRegistration({ ...base, isAdult: null })).toEqual({ ok: false, code: 'age_required' })
  })

  it('mantiene la casilla de ejecución inmediata separada de la de condiciones', () => {
    expect(validateRegistration({ ...base, acceptDigitalExecution: null }))
      .toEqual({ ok: false, code: 'digital_execution_required' })
    expect(validateRegistration({ ...base, acceptTerms: null }))
      .toEqual({ ok: false, code: 'terms_required' })
  })

  it('sigue rechazando un email inválido', () => {
    expect(validateRegistration({ ...base, email: 'no-es-email' })).toEqual({ ok: false, code: 'invalid_email' })
  })

  it('normaliza el email a minúsculas y recorta espacios', () => {
    const r = validateRegistration({ ...base, email: '  Ana@Example.COM  ' })
    expect((r as { data: { email: string } }).data.email).toBe('ana@example.com')
  })

  it('recoge el consentimiento de marketing cuando se marca', () => {
    const r = validateRegistration({ ...base, marketingConsent: 'on' })
    expect((r as { data: { marketingConsent: boolean } }).data.marketingConsent).toBe(true)
  })
})
