import { describe, it, expect } from 'vitest'
import { PLAN_PRICES_EUR, monthlyEquivalent } from '@/utils/admin/plan-prices'

describe('plan prices', () => {
  it('exposes a numeric € price for each plan_type', () => {
    expect(typeof PLAN_PRICES_EUR['1month']).toBe('number')
    expect(typeof PLAN_PRICES_EUR['6months']).toBe('number')
    expect(typeof PLAN_PRICES_EUR['1year']).toBe('number')
  })

  it('monthlyEquivalent("1month", 19) === 19', () => {
    expect(monthlyEquivalent('1month', 19)).toBe(19)
  })

  it('monthlyEquivalent("6months", 90) === 15', () => {
    expect(monthlyEquivalent('6months', 90)).toBe(15)
  })

  it('monthlyEquivalent("1year", 180) === 15', () => {
    expect(monthlyEquivalent('1year', 180)).toBe(15)
  })

  it('returns 0 for unknown plan_type', () => {
    // @ts-expect-error testing unknown plan
    expect(monthlyEquivalent('xx', 100)).toBe(0)
  })
})
