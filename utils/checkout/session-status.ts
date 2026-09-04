/**
 * Stripe ya cobró todo lo que hubiera que cobrar por esta sesión.
 *
 * `paid` es el caso normal. `no_payment_required` es el de un cupón del 100 % o
 * un crédito completo: `allow_promotion_codes` está activo en los dos checkouts
 * (`app/api/checkout/route.ts:100` y el de la landing), así que ese estado se
 * alcanza armando un código desde el dashboard de Stripe, sin desplegar nada.
 *
 * Existe como módulo propio, y no dentro de `provision-registration`, porque el
 * webhook lo necesita y ese módulo se mockea entero en las pruebas: metido allí,
 * el predicado desaparecía en cuanto alguien mockeaba el aprovisionamiento, y el
 * webhook se quedaba comparando contra `undefined` sin que ningún test lo viera.
 *
 * `provisionFromPending` ya aceptaba los dos estados; el webhook comprobaba solo
 * `paid`. Un pedido con cupón del 100 % caía por debajo de sus tres gates,
 * devolvía 200 —así que Stripe no reintentaba—, no aprovisionaba y no avisaba a
 * nadie: el comprador se quedaba sin curso y sin rastro.
 */
export function sesionLiquidada(session: { payment_status?: string | null }): boolean {
  return session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
}
