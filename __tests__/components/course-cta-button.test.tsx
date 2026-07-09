// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/curso-bachatango',
}))

import CourseCtaButton from '@/app/curso-bachatango/_components/CourseCtaButton'

beforeEach(() => {
  vi.clearAllMocks()
  delete (window as any).location
  window.location = { assign: vi.fn() } as any
})

describe('CourseCtaButton', () => {
  it('usuario NO logueado: redirige a signup con next', () => {
    render(<CourseCtaButton courseId="c1" isAuthed={false} label="Comprar" />)
    fireEvent.click(screen.getByRole('button', { name: 'Comprar' }))
    expect(push).toHaveBeenCalledWith('/signup?next=/curso-bachatango')
  })

  it('usuario logueado: llama a /api/checkout y redirige a Stripe', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/x' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<CourseCtaButton courseId="c1" isAuthed={true} label="Comprar" />)
    fireEvent.click(screen.getByRole('button', { name: 'Comprar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/checkout', expect.objectContaining({
      method: 'POST',
    })))
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('https://checkout.stripe.com/x'))
  })
})
