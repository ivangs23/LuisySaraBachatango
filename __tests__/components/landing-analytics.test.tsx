// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

let mockPath = '/'
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }))

import LandingAnalytics from '@/components/LandingAnalytics'

const sendBeacon = vi.fn(() => true)

describe('LandingAnalytics', () => {
  beforeEach(() => {
    sendBeacon.mockClear()
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true })
  })

  it('manda un beacon en una ruta medida', () => {
    mockPath = '/curso-bachatango'
    render(<LandingAnalytics />)
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url, payload] = sendBeacon.mock.calls[0] as unknown as [string, Blob]
    expect(url).toBe('/api/landing-event')
    expect(payload).toBeInstanceOf(Blob)
  })

  it('no manda nada en rutas no medidas', () => {
    mockPath = '/admin/landing'
    render(<LandingAnalytics />)
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('no duplica el envío si se vuelve a renderizar la misma ruta', () => {
    mockPath = '/'
    const { rerender } = render(<LandingAnalytics />)
    rerender(<LandingAnalytics />)
    expect(sendBeacon).toHaveBeenCalledTimes(1)
  })

  it('no renderiza nada en el DOM', () => {
    mockPath = '/'
    const { container } = render(<LandingAnalytics />)
    expect(container).toBeEmptyDOMElement()
  })

  it('no revienta si el navegador no soporta sendBeacon', () => {
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true })
    mockPath = '/'
    expect(() => render(<LandingAnalytics />)).not.toThrow()
  })
})
