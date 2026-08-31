import { describe, it, expect } from 'vitest'
import { normalisePath, TRACKED_PATHS, FUNNEL_STEPS } from '@/utils/analytics/tracked-paths'

describe('normalisePath', () => {
  it('acepta las rutas medidas', () => {
    for (const p of TRACKED_PATHS) expect(normalisePath(p)).toBe(p)
  })

  it('quita query string y hash', () => {
    expect(normalisePath('/curso-bachatango?utm_source=ig')).toBe('/curso-bachatango')
    expect(normalisePath('/curso-bachatango#oferta')).toBe('/curso-bachatango')
    expect(normalisePath('/gracias?session_id=cs_123')).toBe('/gracias')
  })

  it('quita la barra final salvo en la raíz', () => {
    expect(normalisePath('/curso-bachatango/')).toBe('/curso-bachatango')
    expect(normalisePath('/')).toBe('/')
  })

  it('rechaza rutas no declaradas', () => {
    expect(normalisePath('/admin')).toBeNull()
    expect(normalisePath('/courses/abc')).toBeNull()
    expect(normalisePath('/curso-bachatango/comprar/extra')).toBeNull()
  })

  it('rechaza entradas que no son cadenas', () => {
    expect(normalisePath(null)).toBeNull()
    expect(normalisePath(undefined)).toBeNull()
    expect(normalisePath(42)).toBeNull()
    expect(normalisePath({ path: '/' })).toBeNull()
  })

  it('rechaza intentos de colar otra cosa', () => {
    expect(normalisePath('https://evil.com/')).toBeNull()
    expect(normalisePath('//evil.com')).toBeNull()
    expect(normalisePath("/'; drop table landing_events; --")).toBeNull()
    expect(normalisePath('/'.repeat(5000))).toBeNull()
  })

  it('el embudo solo usa rutas medidas y está ordenado', () => {
    expect(FUNNEL_STEPS.length).toBe(4)
    for (const s of FUNNEL_STEPS) expect(TRACKED_PATHS).toContain(s.path)
    expect(FUNNEL_STEPS.map(s => s.path)).toEqual([
      '/', '/curso-bachatango', '/curso-bachatango/comprar', '/gracias',
    ])
  })
})
