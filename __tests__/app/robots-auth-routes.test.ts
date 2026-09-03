import { describe, it, expect } from 'vitest'
import robots from '@/app/robots'

/**
 * `/auth/confirm` lleva el token de un solo uso en la query string. Un
 * rastreador que la visite lo GASTA, y la persona que abre el correo después se
 * encuentra la pantalla de error sin haber hecho nada.
 *
 * `/auth/callback` ya estaba en la lista; la ruta nueva se quedó fuera.
 */
describe('robots.txt — rutas que consumen tokens', () => {
  const rules = robots().rules
  const rule = Array.isArray(rules) ? rules[0] : rules
  const disallow = (rule.disallow ?? []) as string[]

  it('excluye /auth/confirm', () => {
    expect(disallow).toContain('/auth/confirm')
  })

  it('sigue excluyendo las rutas de auth que ya estaban', () => {
    for (const p of ['/auth/callback', '/auth/signout', '/reset-password', '/forgot-password']) {
      expect(disallow).toContain(p)
    }
  })
})
