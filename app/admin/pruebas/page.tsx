import { testCookieExpiry, isTestModeConfigured } from '@/utils/demo/test-mode'
import TestModeToggle from '@/components/admin/TestModeToggle'

export const dynamic = 'force-dynamic'

export default async function AdminTestModePage() {
  const expiresAt = await testCookieExpiry()
  const configured = isTestModeConfigured()

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header>
        <span style={{ fontSize: '0.75rem', letterSpacing: '0.08em', opacity: 0.7 }}>PANEL · ADMIN</span>
        <h1 style={{ margin: '0.25rem 0' }}>Modo pruebas</h1>
        <p style={{ opacity: 0.8, maxWidth: 640 }}>
          Simula compras (sin cobro real) para probar los flujos de pago en el sitio
          en vivo. Afecta <strong>solo a este navegador</strong>: cualquier otro
          visitante paga con Stripe normalmente. Las compras de prueba quedan
          marcadas y se pueden borrar después.
        </p>
      </header>
      <TestModeToggle active={expiresAt !== null} expiresAt={expiresAt} configured={configured} />
    </div>
  )
}
