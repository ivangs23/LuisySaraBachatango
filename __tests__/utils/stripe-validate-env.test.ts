import { describe, it, expect } from 'vitest'
import { assertStripeEnvForProduction } from '@/utils/stripe/validate-env'

describe('assertStripeEnvForProduction', () => {
  it('does nothing outside production', () => {
    expect(() => assertStripeEnvForProduction({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).not.toThrow()
    expect(() => assertStripeEnvForProduction({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).not.toThrow()
  })

  it('throws on test key in production', () => {
    expect(() => assertStripeEnvForProduction({
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: 'sk_test_abcd',
      STRIPE_WEBHOOK_SECRET: 'whsec_xxx',
    } as NodeJS.ProcessEnv)).toThrow(/STRIPE_SECRET_KEY/)
  })

  it('throws on missing webhook secret in production', () => {
    expect(() => assertStripeEnvForProduction({
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: 'sk_live_abcd',
      STRIPE_WEBHOOK_SECRET: '',
    } as NodeJS.ProcessEnv)).toThrow(/STRIPE_WEBHOOK_SECRET/)
  })

  it('passes with live keys', () => {
    expect(() => assertStripeEnvForProduction({
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: 'sk_live_abcd',
      STRIPE_WEBHOOK_SECRET: 'whsec_abcd',
    } as NodeJS.ProcessEnv)).not.toThrow()
  })

  it('skips check when STRIPE_SECRET_KEY is absent in production (build-time safety)', () => {
    expect(() => assertStripeEnvForProduction({
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
    } as NodeJS.ProcessEnv)).not.toThrow()
  })
})
