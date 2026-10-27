// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/admin' }))

import AdminSidebar from '@/components/admin/AdminSidebar'

const enlaceCorreos = () => screen.getByRole('link', { name: /correos/i })

describe('AdminSidebar · Correos', () => {
  it('enlaza al panel de correos', () => {
    render(<AdminSidebar pendingSubmissions={0} />)
    expect(enlaceCorreos()).toHaveAttribute('href', '/admin/correos')
  })

  it('sin correos pendientes no enseña número', () => {
    render(<AdminSidebar pendingSubmissions={0} unsentEmails={0} />)
    expect(enlaceCorreos().textContent).toBe('Correos')
  })

  it('cuenta los correos que no salieron', () => {
    render(<AdminSidebar pendingSubmissions={0} unsentEmails={3} />)
    expect(within(enlaceCorreos()).getByText('3')).toBeInTheDocument()
  })

  it('si no sale ningún correo, lo marca con «!» aunque no haya filas pendientes', () => {
    render(<AdminSidebar pendingSubmissions={0} unsentEmails={0} emailOutage />)
    expect(within(enlaceCorreos()).getByText('!')).toBeInTheDocument()
  })
})
