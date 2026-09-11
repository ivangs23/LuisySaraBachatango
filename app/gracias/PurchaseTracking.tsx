'use client'

import { useEffect, useRef } from 'react'
import { useConsent } from '@/context/ConsentContext'

type Props = {
  /** Id de la sesión de Stripe. Identifica la venta y evita contarla dos veces. */
  transactionId: string
  /** Importe real cobrado, en euros. */
  value: number
  currency: string
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
  }
}

/** Marca en el navegador que esta venta ya se reportó. */
const clave = (id: string) => `venta_reportada_${id}`

function yaReportada(id: string): boolean {
  try {
    return localStorage.getItem(clave(id)) === '1'
  } catch {
    // Navegador con el almacenamiento bloqueado: no se puede deduplicar, pero
    // es preferible arriesgar un duplicado a perder la conversión entera.
    return false
  }
}

function marcarReportada(id: string): void {
  try {
    localStorage.setItem(clave(id), '1')
  } catch { /* sin almacenamiento: nada que marcar */ }
}

/**
 * Reporta la compra a GA4 y al píxel de Meta.
 *
 * Sin esto, las dos herramientas veían una visita más a `/gracias` sin saber
 * que era una venta ni de cuánto: GA4 no calculaba ingresos y Meta solo podía
 * optimizar hacia visitantes, no hacia compradores.
 *
 * Tres cosas que deben cumplirse a la vez, y por eso no basta con soltar los
 * eventos en la página:
 *
 * 1. CONSENTIMIENTO. Cada herramienta va con su categoría. Si el visitante
 *    rechazó, no se reporta nada — igual que no se carga el script.
 *
 * 2. UNA SOLA VEZ. Recargar `/gracias`, volver atrás o compartir la URL
 *    dispararía el evento otra vez e inflaría los ingresos. Se marca la venta
 *    como reportada por `session_id`, que es único por compra.
 *
 * 3. DESPUÉS DE QUE CARGUEN. Los scripts entran con `afterInteractive`, así
 *    que al montar este componente puede que `gtag` o `fbq` aún no existan.
 *    Se espera a que aparezcan en vez de perder el evento.
 */
export default function PurchaseTracking({ transactionId, value, currency }: Props) {
  const { state, hydrated } = useConsent()
  const lanzado = useRef(false)

  useEffect(() => {
    if (!hydrated || !state || lanzado.current) return
    if (!transactionId || !(value > 0)) return
    if (yaReportada(transactionId)) return

    const quiereGa = state.analytics
    const quierePixel = state.marketing
    if (!quiereGa && !quierePixel) return

    let intentos = 0
    const t = setInterval(() => {
      intentos++
      const gaListo = !quiereGa || typeof window.gtag === 'function'
      const pixelListo = !quierePixel || typeof window.fbq === 'function'

      // A los 10 s se deja de esperar: si un bloqueador impidió cargarlos, no
      // van a aparecer y seguir sondeando solo gasta batería.
      if (!(gaListo && pixelListo) && intentos < 20) return
      clearInterval(t)
      if (!(gaListo && pixelListo)) return

      if (quiereGa && window.gtag) {
        window.gtag('event', 'purchase', {
          transaction_id: transactionId,
          value,
          currency,
          items: [{ item_id: 'curso-bachatango', item_name: 'CURSO BACHATANGO', price: value, quantity: 1 }],
        })
      }
      if (quierePixel && window.fbq) {
        // `eventID` permite a Meta descartar el duplicado si algún día se
        // envía la misma compra también desde el servidor (Conversions API).
        window.fbq('track', 'Purchase', { value, currency }, { eventID: transactionId })
      }

      lanzado.current = true
      marcarReportada(transactionId)
    }, 500)

    return () => clearInterval(t)
  }, [hydrated, state, transactionId, value, currency])

  return null
}
