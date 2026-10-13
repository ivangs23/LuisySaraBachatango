import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Requisito AEPD: denegar no puede costar más que aceptar. Hoy lo garantiza un
 * único bloque compartido por `.primary`, `.secondary` y `.tertiary`; lo que
 * las separa es solo el color.
 *
 * Es un test sobre el CSS porque jsdom no calcula los estilos de un CSS
 * Module. Lo que hay que impedir es que alguien saque `.secondary` del bloque
 * compartido o le dé reglas propias que la encojan.
 */
const CSS = readFileSync(
  join(process.cwd(), 'components/CookieConsent.module.css'),
  'utf8',
)

describe('paridad visual entre aceptar y rechazar', () => {
  it('las tres acciones comparten el bloque de tamaño', () => {
    expect(CSS).toMatch(/\.primary,\s*\n\.secondary,\s*\n\.tertiary\s*\{/)
  })

  it('.secondary no se encoge por su cuenta', () => {
    const bloque = CSS.match(/\n\.secondary\s*\{([^}]*)\}/)?.[1] ?? ''
    // Los nombres van anclados al inicio de declaración: sin el `^`, `order`
    // casaría dentro de `border-color` y el test fallaría con el CSS correcto.
    expect(bloque).not.toMatch(/^\s*(font-size|padding|min-width|opacity|order)\s*:/m)
    expect(bloque).not.toMatch(/^\s*display\s*:\s*none/m)
  })
})
