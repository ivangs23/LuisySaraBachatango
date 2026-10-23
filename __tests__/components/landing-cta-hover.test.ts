import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Los botones de compra de la landing son enlaces (<a class="cta">), y
 * globals.css tiene `a:hover { color: var(--primary) }`. Esa regla pesa más
 * que `.cta { color: #050505 }` (0,1,1 frente a 0,1,0), así que al pasar el
 * ratón —o tras un toque en móvil, donde el :hover se queda pegado— el texto
 * se volvía dorado sobre fondo dorado y el botón quedaba ilegible.
 *
 * jsdom no aplica :hover, así que se fija el contrato en la hoja de estilos.
 */
const CSS = readFileSync(join(process.cwd(), 'app/curso-bachatango/page.module.css'), 'utf8')

describe('botón de compra de la landing al pasar el ratón', () => {
  it('.cta:hover mantiene el texto oscuro sobre el dorado', () => {
    expect(CSS).toMatch(/\.cta:hover\s*\{[^}]*\bcolor:\s*#050505/)
  })
})
