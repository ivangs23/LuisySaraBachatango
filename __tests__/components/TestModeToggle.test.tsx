// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/app/admin/pruebas/actions', () => ({
  enableTestMode: vi.fn(),
  disableTestMode: vi.fn(),
}))

import TestModeToggle from '@/components/admin/TestModeToggle'

describe('TestModeToggle', () => {
  it('inactivo: muestra botón Activar', () => {
    render(<TestModeToggle active={false} expiresAt={null} configured={true} />)
    expect(screen.getByRole('button', { name: /activar/i })).toBeEnabled()
  })
  it('activo: muestra Desactivar y estado ACTIVO', () => {
    render(<TestModeToggle active={true} expiresAt={Date.now() + 3_600_000} configured={true} />)
    expect(screen.getByRole('button', { name: /desactivar/i })).toBeInTheDocument()
    expect(screen.getByText(/activo/i)).toBeInTheDocument()
  })
  it('sin configurar: avisa de TEST_MODE_SECRET y deshabilita Activar', () => {
    render(<TestModeToggle active={false} expiresAt={null} configured={false} />)
    expect(screen.getByText(/TEST_MODE_SECRET/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activar/i })).toBeDisabled()
  })
})
