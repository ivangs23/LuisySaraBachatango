// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ compra: vi.fn(), clases: vi.fn() }))
vi.mock('@/app/admin/correos/actions', () => ({
  resendPurchaseEmail: (...a: unknown[]) => h.compra(...a),
  resendFreeClassesEmail: (...a: unknown[]) => h.clases(...a),
}))

import SendEmailButton from '@/components/admin/SendEmailButton'

beforeEach(() => {
  vi.clearAllMocks()
  h.compra.mockResolvedValue({ ok: true })
  h.clases.mockResolvedValue({ ok: true })
})

describe('SendEmailButton', () => {
  it('pregunta antes de mandar y, si se cancela, no manda nada', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<SendEmailButton tipo="compra" refId="p1" label="Enviar" confirmar="¿Mandar a ana@example.com?" />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(confirm).toHaveBeenCalledWith('¿Mandar a ana@example.com?')
    expect(h.compra).not.toHaveBeenCalled()
  })

  it('compra: manda con el id de la compra y dice que salió', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SendEmailButton tipo="compra" refId="p1" label="Enviar" confirmar="?" />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Enviado'))
    expect(h.compra).toHaveBeenCalledWith('p1')
    expect(h.clases).not.toHaveBeenCalled()
  })

  it('clases gratis: manda con el email del alta', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SendEmailButton tipo="clases" refId="eva@example.com" label="Reenviar" confirmar="?" />)
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar' }))
    await waitFor(() => expect(h.clases).toHaveBeenCalledWith('eva@example.com'))
  })

  it('enseña el motivo si no salió', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    h.compra.mockResolvedValue({ ok: false, error: 'Resend no aceptó el correo.' })
    render(<SendEmailButton tipo="compra" refId="p1" label="Enviar" confirmar="?" />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Resend no aceptó el correo.'))
  })

  it('si la acción lanza, no se queda colgado', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    h.compra.mockRejectedValue(new Error('forbidden'))
    render(<SendEmailButton tipo="compra" refId="p1" label="Enviar" confirmar="?" />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/no se pudo enviar/i))
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled()
  })
})
