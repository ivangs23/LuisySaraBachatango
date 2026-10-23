import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { NUTRICION } from '@/utils/email/sequences/nutricion'
import { verifyFreeClassesToken } from '@/utils/newsletter/free-classes-token'
import type { StepContext } from '@/utils/email/sequences/types'

const CTX: StepContext = {
  email: 'ana@example.com',
  base: 'https://luisysarabachatango.com',
  curriculum: { modules: 14, lessons: 28, duration: '2 h 12 min' },
  price: 119,
}
const paso = (n: number) => NUTRICION.steps.find((s) => s.step === n)!

describe('secuencia de nutrición', () => {
  beforeEach(() => { vi.stubEnv('NEWSLETTER_UNSUBSCRIBE_SECRET', 'secreto-de-prueba') })
  afterEach(() => { vi.unstubAllEnvs() })

  it('sigue el calendario del plan: días 0, 2, 4, 7, 10 y 14', () => {
    expect(NUTRICION.name).toBe('nutricion')
    expect(NUTRICION.steps.map((s) => [s.step, s.delayDays])).toEqual([
      [1, 0], [2, 2], [3, 4], [4, 7], [5, 10], [6, 14],
    ])
  })

  it('con los asuntos del plan', () => {
    expect(paso(1).content(CTX)!.subject).toBe('Tus dos clases de bachatango')
    expect(paso(2).content(CTX)!.subject).toBe('El detalle que cambia tu abrazo')
    expect(paso(3).content(CTX)!.subject).toBe('Bailamos juntos desde los 9 años')
    expect(paso(5).content(CTX)!.subject).toBe('¿Y si no tengo pareja?')
    expect(paso(6).content(CTX)!.subject).toBe('El curso completo, 28 lecciones')
  })

  it('el paso 1 lleva a las dos clases con un token válido para esa persona', () => {
    const url = new URL(paso(1).content(CTX)!.boton!.url)
    expect(url.pathname).toBe('/clase-gratis/mas')
    expect(url.searchParams.get('e')).toBe('ana@example.com')
    expect(verifyFreeClassesToken('ana@example.com', url.searchParams.get('t')!)).toBe(true)
  })

  it('el paso 1 no sale sin secreto: no habría enlace válido', () => {
    vi.stubEnv('NEWSLETTER_UNSUBSCRIBE_SECRET', '')
    expect(paso(1).content(CTX)).toBeNull()
  })

  // Regla 9 del plan: nada inventado. Sin un testimonio real, el paso se salta.
  it('el paso 4 (caso real de alumno) no sale hasta que haya material', () => {
    expect(paso(4).content(CTX)).toBeNull()
  })

  it('la oferta lleva las cifras y el precio reales, y no sale sin ellos', () => {
    const c = paso(6).content(CTX)!
    const texto = c.parrafos.join(' ')
    expect(texto).toContain('14 módulos y 28 lecciones en vídeo, 2 h 12 min')
    expect(texto).toContain('119 €')
    expect(paso(6).content({ ...CTX, price: null })).toBeNull()
    expect(paso(6).content({ ...CTX, curriculum: null })).toBeNull()
  })

  it('precisa quién ganó Bailando con las Estrellas (D7)', () => {
    const texto = paso(3).content(CTX)!.parrafos.join(' ')
    expect(texto).toContain('que ganó Luis')
    expect(texto).not.toMatch(/ganadores|ganamos/)
  })

  it('sin urgencias ni escasez inventadas', () => {
    for (const s of NUTRICION.steps) {
      const c = s.content(CTX)
      if (!c) continue
      const todo = [c.subject, c.preheader, c.titulo, ...c.parrafos].join(' ')
      expect(todo, `paso ${s.step}`).not.toMatch(/últimas plazas|quedan \d|solo hoy|hoy mismo|antes de que|se acaba/i)
    }
  })

  it('todos los pasos con contenido llevan botón a la web', () => {
    for (const s of NUTRICION.steps) {
      const c = s.content(CTX)
      if (!c) continue
      expect(c.boton?.url.startsWith(CTX.base), `paso ${s.step}`).toBe(true)
    }
  })
})
