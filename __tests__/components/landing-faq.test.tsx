// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LandingFaq from '@/app/curso-bachatango/_components/LandingFaq'

describe('LandingFaq', () => {
  it('lista las preguntas y despliega la respuesta al pulsar', () => {
    render(<LandingFaq />)
    const q = screen.getByRole('button', { name: /¿Necesito pareja\?/ })
    expect(q).toBeInTheDocument()
    // respuesta oculta hasta expandir
    expect(q).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(q)
    expect(q).toHaveAttribute('aria-expanded', 'true')
  })
})
