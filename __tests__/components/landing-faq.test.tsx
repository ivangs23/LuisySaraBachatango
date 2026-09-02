// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { getLandingCopy } from '@/app/curso-bachatango/copy'
import { render, screen, fireEvent } from '@testing-library/react'
import LandingFaq from '@/app/curso-bachatango/_components/LandingFaq'

// El copy ahora llega por props desde la página, que lo resuelve por idioma.
const COPY = getLandingCopy('es')

describe('LandingFaq', () => {
  it('lista las preguntas y despliega la respuesta al pulsar', () => {
    render(<LandingFaq copy={COPY} />)
    const q = screen.getByRole('button', { name: /¿Necesito pareja\?/ })
    expect(q).toBeInTheDocument()
    // respuesta oculta hasta expandir
    expect(q).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(q)
    expect(q).toHaveAttribute('aria-expanded', 'true')
  })
})
