// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

import PresenceHeartbeat, { HEARTBEAT_MS } from '@/components/PresenceHeartbeat'

const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

describe('PresenceHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('late al montar', () => {
    render(<PresenceHeartbeat />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/presence')
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
  })

  it('no manda cuerpo: el servidor no necesita nada del cliente', () => {
    render(<PresenceHeartbeat />)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.body).toBeUndefined()
  })

  it('vuelve a latir en cada intervalo', () => {
    render(<PresenceHeartbeat />)
    act(() => { vi.advanceTimersByTime(HEARTBEAT_MS) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    act(() => { vi.advanceTimersByTime(HEARTBEAT_MS) })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('calla mientras la pestaña está oculta', () => {
    render(<PresenceHeartbeat />)
    fetchMock.mockClear()
    setVisibility('hidden')
    act(() => { vi.advanceTimersByTime(HEARTBEAT_MS * 3) })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('late en cuanto la pestaña vuelve a verse', () => {
    render(<PresenceHeartbeat />)
    setVisibility('hidden')
    act(() => { vi.advanceTimersByTime(HEARTBEAT_MS) })
    fetchMock.mockClear()

    setVisibility('visible')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('deja de latir al desmontar', () => {
    const { unmount } = render(<PresenceHeartbeat />)
    unmount()
    fetchMock.mockClear()
    act(() => { vi.advanceTimersByTime(HEARTBEAT_MS * 3) })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('un fallo de red no propaga', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    expect(() => render(<PresenceHeartbeat />)).not.toThrow()
    await act(async () => { await Promise.resolve() })
  })
})
