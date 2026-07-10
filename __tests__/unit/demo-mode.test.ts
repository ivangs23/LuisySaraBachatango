import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isDemoMode } from '@/utils/demo/mode'

const ORIG = { ...process.env }
beforeEach(() => { process.env = { ...ORIG } })
afterEach(() => { process.env = { ...ORIG } })

describe('isDemoMode', () => {
  it('false cuando DEMO_MODE no es "true"', () => {
    delete process.env.DEMO_MODE
    expect(isDemoMode()).toBe(false)
  })

  it('true en local/preview con DEMO_MODE=true y dominio no-prod', () => {
    process.env.DEMO_MODE = 'true'
    delete process.env.VERCEL_ENV
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
    expect(isDemoMode()).toBe(true)
  })

  it('true en VERCEL_ENV=preview con DEMO_MODE=true y dominio no-prod', () => {
    process.env.DEMO_MODE = 'true'
    process.env.VERCEL_ENV = 'preview'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://preview.vercel.app'
    expect(isDemoMode()).toBe(true)
  })

  it('false en VERCEL_ENV=production aunque DEMO_MODE=true', () => {
    process.env.DEMO_MODE = 'true'
    process.env.VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://preview.vercel.app'
    expect(isDemoMode()).toBe(false)
  })

  it('false en VERCEL_ENV desconocido (no allowlisted) aunque DEMO_MODE=true y dominio no-prod', () => {
    process.env.DEMO_MODE = 'true'
    process.env.VERCEL_ENV = 'some-unknown'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://preview.vercel.app'
    expect(isDemoMode()).toBe(false)
  })

  it('false si el dominio es el de producción real aunque DEMO_MODE=true', () => {
    process.env.DEMO_MODE = 'true'
    delete process.env.VERCEL_ENV
    process.env.NEXT_PUBLIC_BASE_URL = 'https://luisysarabachatango.com'
    expect(isDemoMode()).toBe(false)
  })
})
