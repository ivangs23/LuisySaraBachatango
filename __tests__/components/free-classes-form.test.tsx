// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const requestFreeClasses = vi.fn()
vi.mock('@/app/actions/free-classes', () => ({ requestFreeClasses: (fd: FormData) => requestFreeClasses(fd) }))

let marketing = false
vi.mock('@/context/ConsentContext', () => ({
  useConsent: () => ({ state: { marketing }, hydrated: true }),
}))

import FreeClassesForm, { FREE_CLASSES_ANCHOR } from '@/components/FreeClassesForm'
import { getLandingCopy } from '@/app/curso-bachatango/copy'

const COPY = getLandingCopy('es').freeEmail
const fbq = vi.fn()

function rellenarYEnviar(email = 'ana@example.com') {
  fireEvent.change(screen.getByLabelText(COPY.emailLabel), { target: { value: email } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: COPY.cta }))
}

describe('FreeClassesForm', () => {
  beforeEach(() => {
    marketing = false
    requestFreeClasses.mockReset()
    fbq.mockReset()
    Object.defineProperty(window, 'fbq', { value: fbq, configurable: true, writable: true })
  })

  it('pide el email y el consentimiento explícito, con el texto acordado', () => {
    render(<FreeClassesForm copy={COPY} />)
    expect(screen.getByRole('heading', { name: '¿Te ha gustado? Te mandamos dos clases más' })).toBeInTheDocument()
    expect(screen.getByLabelText(COPY.emailLabel)).toBeRequired()
    const casilla = screen.getByRole('checkbox', { name: COPY.consent })
    expect(casilla).toBeRequired()
    // El consentimiento no puede venir marcado de serie (RGPD, considerando 32).
    expect(casilla).not.toBeChecked()
  })

  it('lleva el ancla a la que salta el enlace de la barra fija', () => {
    const { container } = render(<FreeClassesForm copy={COPY} />)
    expect(container.querySelector(`#${FREE_CLASSES_ANCHOR}`)).not.toBeNull()
  })

  it('al apuntarse cambia el formulario por la confirmación', async () => {
    requestFreeClasses.mockResolvedValue({ success: true, eventId: 'ev-1' })
    render(<FreeClassesForm copy={COPY} />)
    rellenarYEnviar()
    expect(await screen.findByRole('status')).toHaveTextContent(COPY.success)
    expect(screen.queryByRole('button', { name: COPY.cta })).toBeNull()
  })

  it('con consentimiento de marketing manda Lead al píxel con el event_id del servidor', async () => {
    marketing = true
    requestFreeClasses.mockResolvedValue({ success: true, eventId: 'ev-1' })
    render(<FreeClassesForm copy={COPY} />)
    rellenarYEnviar()
    await screen.findByRole('status')
    expect(fbq).toHaveBeenCalledWith('track', 'Lead', expect.any(Object), { eventID: 'ev-1' })
  })

  it('sin consentimiento de marketing el píxel no se entera', async () => {
    requestFreeClasses.mockResolvedValue({ success: true, eventId: 'ev-1' })
    render(<FreeClassesForm copy={COPY} />)
    rellenarYEnviar()
    await screen.findByRole('status')
    expect(fbq).not.toHaveBeenCalled()
  })

  it('traduce el código de error a un mensaje', async () => {
    requestFreeClasses.mockResolvedValue({ error: 'rate_limit' })
    render(<FreeClassesForm copy={COPY} />)
    rellenarYEnviar()
    expect(await screen.findByRole('alert')).toHaveTextContent(COPY.errors.rate_limit)
  })
})
