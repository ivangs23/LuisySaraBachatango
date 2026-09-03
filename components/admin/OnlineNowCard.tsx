'use client'

import { useEffect, useState } from 'react'
import { Radio } from 'lucide-react'
import AdminKpiCard from './AdminKpiCard'
import { fetchOnlineNow } from '@/app/admin/presence-actions'

/** El panel se refresca solo. Más corto que esto no aporta: la ventana es de 2 min. */
export const POLL_MS = 15_000

/**
 * Visitantes conectados ahora mismo.
 *
 * El valor inicial llega renderizado del servidor (ya tras `requireAdmin()`) y a
 * partir de ahí se refresca solo. Un `null` de la acción se ignora: se mantiene
 * el último valor bueno en lugar de mostrar un cero falso.
 */
export default function OnlineNowCard({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial)

  useEffect(() => {
    let alive = true

    const timer = setInterval(() => {
      // El `.catch` no es decorativo. `fetchOnlineNow()` ya devuelve null ante un
      // error de servidor, pero un fallo de TRANSPORTE —red caída, móvil que
      // duerme la pestaña— rechaza la llamada antes de que llegue a ejecutarse.
      // Sin esto, cada fallo dejaba escapar un rechazo sin capturar y Sentry lo
      // registraba como `TypeError: Failed to fetch` en /admin. Un contador que
      // se refresca solo no puede ensuciar el canal donde vigilas los cobros.
      // El siguiente tick reintenta; no hace falta más.
      fetchOnlineNow()
        .then((next) => { if (alive && next !== null) setCount(next) })
        .catch(() => {})
    }, POLL_MS)

    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  return (
    <AdminKpiCard
      Icon={Radio}
      label="Online ahora"
      value={String(count)}
      sub="Últimos 2 min"
    />
  )
}
