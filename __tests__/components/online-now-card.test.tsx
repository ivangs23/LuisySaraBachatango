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
