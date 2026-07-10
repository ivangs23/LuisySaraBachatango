import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isDemoMode } from '@/utils/demo/mode'

const ORIG = { ...process.env }
beforeEach(() => { process.env = { ...ORIG } })
afterEach(() => { process.env = { ...ORIG } })

describe('isDemoMode (automático por entorno)', () => {
  it('true en local (VERCEL_ENV undefined) con dominio no-prod', () => {
    delete process.env.VERCEL_ENV
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
    expect(isDemoMode()).toBe(true)
  })

  it('true en VERCEL_ENV=preview con dominio no-prod', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://preview.vercel.app'
    expect(isDemoMode()).toBe(true)
  })

  it('true en VERCEL_ENV=development', () => {
    process.env.VERCEL_ENV = 'development'
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
    expect(isDemoMode()).toBe(true)
  })

  it('false en VERCEL_ENV=production', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://preview.vercel.app'
    expect(isDemoMode()).toBe(false)
  })

  it('false en VERCEL_ENV desconocido (fail-safe a producción)', () => {
    process.env.VERCEL_ENV = 'some-unknown'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://preview.vercel.app'
    expect(isDemoMode()).toBe(false)
  })

  it('false si el dominio es el de producción real aunque VERCEL_ENV no sea production', () => {
    delete process.env.VERCEL_ENV
    process.env.NEXT_PUBLIC_BASE_URL = 'https://luisysarabachatango.com'
    expect(isDemoMode()).toBe(false)
  })
})
