import { describe, it, expect } from 'vitest'
import {
  normalisePath, TRACKED_PATHS, FUNNEL_STEPS, EVENT_PATHS, FREE_CLASS_PLAY_PATH, FREE_CLASS_LEAD_PATH,
} from '@/utils/analytics/tracked-paths'

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
    expect(FUNNEL_STEPS.length).toBe(5)
    for (const s of FUNNEL_STEPS) expect(TRACKED_PATHS).toContain(s.path)
    expect(FUNNEL_STEPS.map(s => s.path)).toEqual([
      '/', '/curso-bachatango', '/curso-bachatango/comprar', '/curso-bachatango/comprar/enviado', '/gracias',
    ])
  })

  // T2.3: el play de la clase gratis no es una página sino un evento que se
  // guarda en la misma tabla con una ruta inventada.
  it('el play de la clase gratis se acepta, pero no es un paso del embudo', () => {
    expect(FREE_CLASS_PLAY_PATH).toBe('/curso-bachatango/clase-play')
    expect(normalisePath(FREE_CLASS_PLAY_PATH)).toBe(FREE_CLASS_PLAY_PATH)
    expect(EVENT_PATHS).toContain(FREE_CLASS_PLAY_PATH)
    expect(FUNNEL_STEPS.map(s => s.path)).not.toContain(FREE_CLASS_PLAY_PATH)
  })

  // T3.1: el email capturado en el formulario de las clases gratis.
  it('el lead del formulario de clases es un evento medido, fuera del embudo', () => {
    expect(FREE_CLASS_LEAD_PATH).toBe('/curso-bachatango/lead')
    expect(normalisePath(FREE_CLASS_LEAD_PATH)).toBe(FREE_CLASS_LEAD_PATH)
    expect(EVENT_PATHS).toContain(FREE_CLASS_LEAD_PATH)
    expect(FUNNEL_STEPS.map(s => s.path)).not.toContain(FREE_CLASS_LEAD_PATH)
  })

  it('el paso de envío del formulario es una ruta medida y va en el embudo', () => {
    expect(normalisePath('/curso-bachatango/comprar/enviado')).toBe('/curso-bachatango/comprar/enviado')
    expect(FUNNEL_STEPS.map(s => s.path)).toEqual([
      '/', '/curso-bachatango', '/curso-bachatango/comprar', '/curso-bachatango/comprar/enviado', '/gracias',
    ])
  })
})
