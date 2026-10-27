'use client'

import { useState, useTransition } from 'react'
import { resendPurchaseEmail, resendFreeClassesEmail, type ReenvioResult } from '@/app/admin/correos/actions'

type Props = {
  tipo: 'compra' | 'clases'
  /** Id de la compra, o el email del alta. */
  refId: string
  /** «Enviar» si no salió, «Reenviar» si ya salió uno. */
  label: string
  /** Lo que se pregunta antes de mandar: el correo llega a una persona real. */
  confirmar: string
}

export default function SendEmailButton({ tipo, refId, label, confirmar }: Props) {
  const [pending, startTransition] = useTransition()
  const [resultado, setResultado] = useState<ReenvioResult | null>(null)

  function onClick() {
    if (!window.confirm(confirmar)) return
    setResultado(null)
    startTransition(async () => {
      try {
        setResultado(tipo === 'compra' ? await resendPurchaseEmail(refId) : await resendFreeClassesEmail(refId))
      } catch {
        setResultado({ ok: false, error: 'No se pudo enviar. Recarga la página y prueba otra vez.' })
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        style={{
          background: pending ? 'rgba(var(--primary-rgb), 0.45)' : 'rgba(var(--primary-rgb), 1)',
          color: '#111',
          border: 'none',
          borderRadius: 6,
          padding: '0.4rem 0.85rem',
          fontSize: '0.82rem',
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {pending ? 'Enviando…' : label}
      </button>
      {resultado && (
        <span role="status" style={{ fontSize: '0.78rem', color: resultado.ok ? '#8be0a8' : '#ff9c9c' }}>
          {resultado.ok ? 'Enviado' : resultado.error}
        </span>
      )}
    </div>
  )
}
