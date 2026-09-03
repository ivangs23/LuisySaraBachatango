// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const fetchOnlineNow = vi.fn<() => Promise<number | null>>()
vi.mock('@/app/admin/presence-actions', () => ({ fetchOnlineNow: () => fetchOnlineNow() }))

import OnlineNowCard, { POLL_MS } from '@/components/admin/OnlineNowCard'

describe('OnlineNowCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchOnlineNow.mockReset().mockResolvedValue(4)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pinta el valor que llega del servidor', () => {
    render(<OnlineNowCard initial={3} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('se refresca solo en cada intervalo', async () => {
    render(<OnlineNowCard initial={3} />)
    await act(async () => { vi.advanceTimersByTime(POLL_MS) })
    expect(fetchOnlineNow).toHaveBeenCalledTimes(1)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('mantiene el último valor bueno si una consulta falla', async () => {
    render(<OnlineNowCard initial={3} />)
    fetchOnlineNow.mockResolvedValueOnce(null)
    await act(async () => { vi.advanceTimersByTime(POLL_MS) })
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  /**
   * Sentry recogió esto en producción como `TypeError: Failed to fetch` en
   * /admin, sin capturar, con la traza en `fetchServerAction` de Next: la red se
   * cae o el móvil duerme la pestaña, la llamada a la server action se rechaza y
   * nadie la atrapa. La acción devuelve null ante un error de servidor, pero un
   * fallo de TRANSPORTE revienta antes de llegar a ejecutarse.
   */
  it('no deja escapar el rechazo cuando la red falla', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    render(<OnlineNowCard initial={3} />)
    fetchOnlineNow.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await act(async () => { vi.advanceTimersByTime(POLL_MS) })

    // Node solo emite `unhandledRejection` en un macrotask real, y los timers
    // falsos no dan ninguno: hay que soltarlos para que llegue a notificarlo.
    vi.useRealTimers()
    await new Promise(r => setTimeout(r, 10))

    process.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('sigue consultando después de un fallo de red', async () => {
    render(<OnlineNowCard initial={3} />)
    fetchOnlineNow.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await act(async () => { vi.advanceTimersByTime(POLL_MS) })

    fetchOnlineNow.mockResolvedValueOnce(7)
    await act(async () => { vi.advanceTimersByTime(POLL_MS) })
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('no sigue consultando tras desmontar', async () => {
    const { unmount } = render(<OnlineNowCard initial={3} />)
    unmount()
    fetchOnlineNow.mockClear()
    await act(async () => { vi.advanceTimersByTime(POLL_MS * 3) })
    expect(fetchOnlineNow).not.toHaveBeenCalled()
  })

  it('nombra la ventana de medida, para no leer el número como exacto', () => {
    render(<OnlineNowCard initial={3} />)
    expect(screen.getByText(/2 min/i)).toBeInTheDocument()
  })
})
