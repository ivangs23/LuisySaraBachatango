import { describe, it, expect } from 'vitest'
import { isChromelessRoute } from '@/utils/nav/chromeless-routes'

describe('isChromelessRoute', () => {
  it('hides chrome on the whole sales funnel', () => {
    for (const p of ['/curso-bachatango', '/curso-bachatango/comprar', '/gracias']) {
      expect(isChromelessRoute(p)).toBe(true)
    }
  })
  it('shows chrome on every other route (and null/undefined)', () => {
    for (const p of ['/', '/courses', '/login', '/curso-bachatangoX', null, undefined]) {
      expect(isChromelessRoute(p)).toBe(false)
    }
  })
})
