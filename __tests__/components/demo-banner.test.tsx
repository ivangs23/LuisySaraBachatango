// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DemoBanner from '@/components/DemoBanner'

describe('DemoBanner', () => {
  it('muestra el aviso de modo pruebas', () => {
    render(<DemoBanner />)
    expect(screen.getByText(/MODO PRUEBAS/i)).toBeInTheDocument()
  })
})
