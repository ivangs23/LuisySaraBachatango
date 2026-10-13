import { describe, it, expect } from 'vitest'
import { statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Presupuesto de iconos. Antes pesaban 82 KB (favicon.ico) y 55 KB (icon.png)
 * y se descargaban en cada carga móvil de la landing de pago: 136 KB por
 * delante del contenido. Un favicon correcto no pasa de unos pocos KB.
 *
 * Si alguien vuelve a exportar el logo a tamaño completo sobre estos ficheros,
 * este test lo para antes del despliegue.
 */
const PRESUPUESTO_BYTES: Record<string, number> = {
  'app/favicon.ico': 15_000,
  'app/icon.png': 10_000,
  'app/apple-icon.png': 25_000,
}

describe('presupuesto de iconos', () => {
  for (const [ruta, maximo] of Object.entries(PRESUPUESTO_BYTES)) {
    it(`${ruta} pesa menos de ${Math.round(maximo / 1000)} KB`, () => {
      const bytes = statSync(join(process.cwd(), ruta)).size
      expect(bytes).toBeLessThan(maximo)
    })
  }
})
