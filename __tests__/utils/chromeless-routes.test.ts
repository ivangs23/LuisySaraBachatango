import { describe, it, expect } from 'vitest'
import { isChromelessRoute } from '@/utils/nav/chromeless-routes'

describe('isChromelessRoute', () => {
  it('hides chrome on the whole sales funnel', () => {
    for (const p of ['/curso-bachatango', '/curso-bachatango/comprar', '/gracias']) {
      expect(isChromelessRoute(p)).toBe(true)
    }
  })
  it('hides chrome on the printable certificate', () => {
    expect(isChromelessRoute('/courses/abc-123/certificado')).toBe(true)
    expect(isChromelessRoute('/courses/abc-123/certificado/')).toBe(true)
  })

  it('shows chrome on every other route (and null/undefined)', () => {
    for (const p of [
      '/', '/courses', '/login', '/curso-bachatangoX',
      // Ni la ficha del curso ni una lección son el certificado.
      '/courses/abc-123', '/courses/abc-123/lesson-1',
      '/courses/abc-123/certificado/extra',
      null, undefined,
    ]) {
      expect(isChromelessRoute(p)).toBe(false)
    }
  })
})
