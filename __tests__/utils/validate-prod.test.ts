import { describe, it, expect } from 'vitest'
import { assertProdEnv } from '@/utils/env/validate-prod'

describe('assertProdEnv', () => {
  it('does nothing outside production', () => {
    expect(() => assertProdEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).not.toThrow()
    expect(() => assertProdEnv({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).not.toThrow()
  })

  it('does nothing during build phase', () => {
    expect(() => assertProdEnv({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build',
    } as NodeJS.ProcessEnv)).not.toThrow()
  })

  it('throws on test stripe key in production', () => {
    expect(() => assertProdEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_BASE_URL: 'https://example.com',
      STRIPE_SECRET_KEY: 'sk_test_abcd',
      STRIPE_WEBHOOK_SECRET: 'whsec_xxx',
    } as NodeJS.ProcessEnv)).toThrow(/STRIPE_SECRET_KEY/)
  })

  it('throws on missing NEXT_PUBLIC_BASE_URL in production', () => {
    expect(() => assertProdEnv({
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: 'sk_live_abcd',
      STRIPE_WEBHOOK_SECRET: 'whsec_abcd',
    } as NodeJS.ProcessEnv)).toThrow(/NEXT_PUBLIC_BASE_URL/)
  })

  it('throws on http (non-https) BASE_URL in production', () => {
    expect(() => assertProdEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_BASE_URL: 'http://example.com',
      STRIPE_SECRET_KEY: 'sk_live_abcd',
      STRIPE_WEBHOOK_SECRET: 'whsec_abcd',
    } as NodeJS.ProcessEnv)).toThrow(/NEXT_PUBLIC_BASE_URL/)
  })

  it('throws on missing webhook secret in production', () => {
    expect(() => assertProdEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_BASE_URL: 'https://example.com',
      STRIPE_SECRET_KEY: 'sk_live_abcd',
      STRIPE_WEBHOOK_SECRET: '',
    } as NodeJS.ProcessEnv)).toThrow(/STRIPE_WEBHOOK_SECRET/)
  })

  it('passes with all live values', () => {
    expect(() => assertProdEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_BASE_URL: 'https://luisy-sara-bachatango.vercel.app',
      STRIPE_SECRET_KEY: 'sk_live_abcd',
      STRIPE_WEBHOOK_SECRET: 'whsec_abcd',
    } as NodeJS.ProcessEnv)).not.toThrow()
  })
})
