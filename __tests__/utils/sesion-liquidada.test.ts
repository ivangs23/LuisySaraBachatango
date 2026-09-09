import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { sesionLiquidada } from '@/utils/checkout/session-status'

/**
 * `allow_promotion_codes` está activo en los dos checkouts, así que un cupón del
 * 100 % se arma desde el dashboard de Stripe sin desplegar nada. Ese pedido
 * llega con `no_payment_required`, y el webhook comprobaba solo `paid`: caía por
 * debajo de los tres gates, devolvía 200 —Stripe no reintenta— y el comprador se
 * quedaba sin curso y sin rastro.
 */
describe('sesionLiquidada', () => {
  it('acepta el pago normal con tarjeta', () => {
    expect(sesionLiquidada({ payment_status: 'paid' })).toBe(true)
  })

  it('acepta un cupón del 100 %: Stripe cobró todo lo que había que cobrar', () => {
    expect(sesionLiquidada({ payment_status: 'no_payment_required' })).toBe(true)
  })

  it('rechaza lo que no está cobrado', () => {
    for (const estado of ['unpaid', 'pending', '', null, undefined]) {
      expect(sesionLiquidada({ payment_status: estado })).toBe(false)
    }
  })

  it('rechaza una sesión sin el campo', () => {
    expect(sesionLiquidada({})).toBe(false)
  })
})
