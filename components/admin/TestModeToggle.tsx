'use client'

import { enableTestMode, disableTestMode } from '@/app/admin/pruebas/actions'

type Props = { active: boolean; expiresAt: number | null; configured: boolean }

export default function TestModeToggle({ active, expiresAt, configured }: Props) {
  const expiresLabel =
    active && expiresAt
      ? new Date(expiresAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 520 }}>
      {!configured && (
        <p style={{ color: '#8a1c1c', fontWeight: 600 }}>
          Falta la variable <code>TEST_MODE_SECRET</code>. El modo pruebas está
          desactivado hasta configurarla.
        </p>
      )}

      {active ? (
        <>
          <p style={{ fontWeight: 600 }}>
            🟢 Modo pruebas ACTIVO en este navegador
            {expiresLabel ? ` — caduca a las ${expiresLabel}` : ''}.
          </p>
          <form action={disableTestMode}>
            <button type="submit" style={btn('#8a1c1c')}>Desactivar modo pruebas</button>
          </form>
        </>
      ) : (
        <>
          <p>El modo pruebas simula los pagos <strong>solo en este navegador</strong>. Caduca solo en 2 horas.</p>
          <form action={enableTestMode}>
            <button type="submit" disabled={!configured} style={btn('#0a7d33', !configured)}>
              Activar modo pruebas
            </button>
          </form>
        </>
      )}
    </div>
  )
}

function btn(bg: string, disabled = false): React.CSSProperties {
  return {
    background: disabled ? '#9aa' : bg,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '0.6rem 1rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
