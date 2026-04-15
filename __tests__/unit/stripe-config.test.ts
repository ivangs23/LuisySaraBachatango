import { describe, it, expect } from 'vitest'
import { STRIPE_CONFIG } from '@/utils/stripe/config'

describe('STRIPE_CONFIG', () => {
  it('uses EUR as currency', () => {
    expect(STRIPE_CONFIG.CURRENCY).toBe('eur')
  })

  it('has subscription price IDs defined', () => {
    expect(STRIPE_CONFIG.SUBSCRIPTION_PRICES).toBeDefined()
    expect(typeof STRIPE_CONFIG.SUBSCRIPTION_PRICES).toBe('object')
  })

  it('has all three subscription tiers', () => {
    const prices = STRIPE_CONFIG.SUBSCRIPTION_PRICES
    expect(prices['1month']).toBeDefined()
    expect(prices['6months']).toBeDefined()
    expect(prices['1year']).toBeDefined()
  })

  it('price IDs are non-empty strings', () => {
    for (const [tier, id] of Object.entries(STRIPE_CONFIG.SUBSCRIPTION_PRICES)) {
      expect(typeof id, `tier "${tier}" price ID should be a string`).toBe('string')
      expect(id.length, `tier "${tier}" price ID should not be empty`).toBeGreaterThan(0)
    }
  })

  // This test will fail until distinct price IDs are configured — serves as a reminder
  it.todo('each subscription tier has a DISTINCT price ID')
})
