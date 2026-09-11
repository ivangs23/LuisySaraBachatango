// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import PurchaseTracking from '@/app/gracias/PurchaseTracking'

const consentMock = vi.fn()
vi.mock('@/context/ConsentContext', () => ({ useConsent: () => consentMock() }))

const SESION = 'cs_live_abc123'

function conConsentimiento(analytics: boolean, marketing: boolean) {
  consentMock.mockReturnValue({ hydrated: true, state: { v: 1, analytics, marketing, at: '' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal('gtag', vi.fn())
  vi.stubGlobal('fbq', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

const gtag = () => (window as unknown as { gtag: ReturnType<typeof vi.fn> }).gtag
const fbq = () => (window as unknown as { fbq: ReturnType<typeof vi.fn> }).fbq

describe('PurchaseTracking', () => {
  it('reporta la compra a GA4 y a Meta con el importe real', async () => {
    conConsentimiento(true, true)
    render(<PurchaseTracking transactionId={SESION} value={119} currency="EUR" />)

    await waitFor(() => expect(gtag()).toHaveBeenCalled(), { timeout: 3000 })
    const [evento, nombre, datos] = gtag().mock.calls[0]
    expect(evento).toBe('event')
    expect(nombre).toBe('purchase')
    expect(datos).toEqual(expect.objectContaining({ transaction_id: SESION, value: 119, currency: 'EUR' }))

    const [accion, tipo, payload, opts] = fbq().mock.calls[0]
    expect([accion, tipo]).toEqual(['track', 'Purchase'])
    expect(payload).toEqual({ value: 119, currency: 'EUR' })
    // eventID deja a Meta descartar el duplicado si algún día se envía también
    // desde el servidor.
    expect(opts).toEqual({ eventID: SESION })
  })

  it('NO vuelve a reportar la misma venta al recargar', async () => {
    // El riesgo concreto: recargar /gracias multiplicaría los ingresos.
    conConsentimiento(true, true)
    const primera = render(<PurchaseTracking transactionId={SESION} value={119} currency="EUR" />)
    await waitFor(() => expect(gtag()).toHaveBeenCalledTimes(1), { timeout: 3000 })
    primera.unmount()

    render(<PurchaseTracking transactionId={SESION} value={119} currency="EUR" />)
    await new Promise(r => setTimeout(r, 1200))
    expect(gtag(), 'contó la venta dos veces').toHaveBeenCalledTimes(1)
    expect(fbq()).toHaveBeenCalledTimes(1)
  })

  it('otra venta distinta sí se reporta', async () => {
    conConsentimiento(true, true)
    render(<PurchaseTracking transactionId={SESION} value={119} currency="EUR" />)
    await waitFor(() => expect(gtag()).toHaveBeenCalledTimes(1), { timeout: 3000 })
    render(<PurchaseTracking transactionId="cs_live_otra" value={119} currency="EUR" />)
    await waitFor(() => expect(gtag()).toHaveBeenCalledTimes(2), { timeout: 3000 })
  })

  it('sin consentimiento no reporta nada', async () => {
    conConsentimiento(false, false)
    render(<PurchaseTracking transactionId={SESION} value={119} currency="EUR" />)
    await new Promise(r => setTimeout(r, 1200))
    expect(gtag()).not.toHaveBeenCalled()
    expect(fbq()).not.toHaveBeenCalled()
  })

  it('solo analítica: reporta a GA4 y no a Meta', async () => {
    conConsentimiento(true, false)
    render(<PurchaseTracking transactionId={SESION} value={119} currency="EUR" />)
    await waitFor(() => expect(gtag()).toHaveBeenCalled(), { timeout: 3000 })
    expect(fbq()).not.toHaveBeenCalled()
  })

  it('solo marketing: reporta a Meta y no a GA4', async () => {
    conConsentimiento(false, true)
    render(<PurchaseTracking transactionId={SESION} value={119} currency="EUR" />)
    await waitFor(() => expect(fbq()).toHaveBeenCalled(), { timeout: 3000 })
    expect(gtag()).not.toHaveBeenCalled()
  })

  it('no reporta importes vacíos ni sesiones sin id', async () => {
    conConsentimiento(true, true)
    render(<PurchaseTracking transactionId={SESION} value={0} currency="EUR" />)
    render(<PurchaseTracking transactionId="" value={119} currency="EUR" />)
    await new Promise(r => setTimeout(r, 1200))
    expect(gtag()).not.toHaveBeenCalled()
    expect(fbq()).not.toHaveBeenCalled()
  })

  it('espera a que el script exista en vez de perder el evento', async () => {
    // Los scripts entran con `afterInteractive`: al montar puede no haber gtag.
    conConsentimiento(true, false)
    vi.stubGlobal('gtag', undefined)
    render(<PurchaseTracking transactionId={SESION} value={119} currency="EUR" />)
    await new Promise(r => setTimeout(r, 800))
    const tardio = vi.fn()
    vi.stubGlobal('gtag', tardio)
    await waitFor(() => expect(tardio).toHaveBeenCalled(), { timeout: 3000 })
  })
})
