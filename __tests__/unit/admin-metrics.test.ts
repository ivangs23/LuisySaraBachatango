import { describe, it, expect } from 'vitest'
import {
  computeMRR,
  groupByMonth,
  pctChange,
  formatRelative,
  centsToEur,
} from '@/utils/admin/metrics'
import { PLAN_PRICES_EUR } from '@/utils/admin/plan-prices'

describe('computeMRR', () => {
  it('sums monthly-equivalent for active subs', () => {
    const subs = [
      { plan_type: '1month' as const },
      { plan_type: '6months' as const },
      { plan_type: '1year' as const },
    ]
    PLAN_PRICES_EUR['1month'] = 19
    PLAN_PRICES_EUR['6months'] = 90
    PLAN_PRICES_EUR['1year'] = 180
    expect(computeMRR(subs)).toBeCloseTo(19 + 15 + 15, 2)
  })

  it('returns 0 with no subs', () => {
    expect(computeMRR([])).toBe(0)
  })
})

describe('groupByMonth', () => {
  it('groups dates into ISO month keys with sums', () => {
    const rows = [
      { date: '2026-01-15', amount: 100 },
      { date: '2026-01-28', amount: 50 },
      { date: '2026-02-03', amount: 200 },
    ]
    const out = groupByMonth(rows, r => r.date, r => r.amount)
    expect(out).toEqual([
      { month: '2026-01', value: 150 },
      { month: '2026-02', value: 200 },
    ])
  })

  it('returns empty array for empty input', () => {
    expect(groupByMonth([], () => '2026-01-01', () => 0)).toEqual([])
  })
})

describe('pctChange', () => {
  it('+50% from 100 to 150', () => {
    expect(pctChange(100, 150)).toBe(50)
  })
  it('-25% from 200 to 150', () => {
    expect(pctChange(200, 150)).toBe(-25)
  })
  it('returns null when previous is 0', () => {
    expect(pctChange(0, 100)).toBeNull()
  })
})

describe('centsToEur', () => {
  it('1234 → 12.34', () => {
    expect(centsToEur(1234)).toBe(12.34)
  })
  it('null → 0', () => {
    expect(centsToEur(null)).toBe(0)
  })
})

describe('formatRelative', () => {
  it('uses "hace Xh" for hours', () => {
    const d = new Date(Date.now() - 3 * 3600_000)
    expect(formatRelative(d.toISOString())).toMatch(/hace 3h/)
  })
  it('uses "hace Xd" for days', () => {
    const d = new Date(Date.now() - 5 * 86_400_000)
    expect(formatRelative(d.toISOString())).toMatch(/hace 5d/)
  })
  it('uses "hace Xmin" for minutes', () => {
    const d = new Date(Date.now() - 7 * 60_000)
    expect(formatRelative(d.toISOString())).toMatch(/hace 7min/)
  })
})
