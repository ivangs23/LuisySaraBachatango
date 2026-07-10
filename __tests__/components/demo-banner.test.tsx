// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DemoBanner from '@/components/DemoBanner'

describe('DemoBanner', () => {
  it('muestra el aviso de modo demo', () => {
    render(<DemoBanner />)
    expect(screen.getByText(/MODO DEMO/i)).toBeInTheDocument()
  })
})
