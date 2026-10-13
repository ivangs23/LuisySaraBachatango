import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Session Replay arrastra su propio bundle a TODAS las páginas, la landing de
 * pago incluida, y nunca se ha usado para diagnosticar nada. Los errores y el
 * tracing se conservan.
 *
 * Es un test sobre el fuente, no sobre el comportamiento, porque lo que se
 * quiere fijar es una decisión de presupuesto de bytes: si alguien reactiva
 * Replay, que sea a sabiendas y cambiando este test.
 */
describe('Sentry en navegador', () => {
  const fuente = readFileSync(join(process.cwd(), 'instrumentation-client.ts'), 'utf8')

  it('no graba sesiones', () => {
    expect(fuente).toMatch(/replaysSessionSampleRate:\s*0\s*,/)
  })

  it('no graba sesiones al fallar', () => {
    expect(fuente).toMatch(/replaysOnErrorSampleRate:\s*0\s*,/)
  })

  it('sigue reportando errores en producción', () => {
    expect(fuente).toContain("enabled: process.env.NODE_ENV === 'production'")
  })
})
