// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '@/context/LanguageContext'
import Testimonials from '@/components/Testimonials'
import FAQ from '@/components/FAQ'
import type { Testimonial, FaqItem } from '@/utils/landing/content'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}))

const TESTIMONIALS: Testimonial[] = [
  { id: 'a', name: 'Ana Real', quote: 'Aprendí muchísimo.', stars: 4 },
  { id: 'b', name: 'Bruno Real', quote: 'Muy recomendable.', stars: 5 },
]

const FAQS: FaqItem[] = [
  { id: 'f1', question: '¿Pregunta de la BD?', answer: 'Respuesta de la BD.' },
]

function wrap(ui: React.ReactNode) {
  return render(<LanguageProvider initialLocale="es">{ui}</LanguageProvider>)
}

describe('Testimonials', () => {
  it('pinta lo que recibe por props, no los nombres antiguos', () => {
    wrap(<Testimonials items={TESTIMONIALS} />)
    expect(screen.getByText('Ana Real')).toBeInTheDocument()
    expect(screen.queryByText('Elena M.')).toBeNull()
  })

  it('respeta las estrellas de cada testimonio', () => {
    const { container } = wrap(<Testimonials items={TESTIMONIALS} />)
    const stars = container.querySelectorAll('[data-stars]')
    expect(stars[0].getAttribute('data-stars')).toBe('4')
    expect(stars[1].getAttribute('data-stars')).toBe('5')
  })

  it('no renderiza la sección si no hay testimonios', () => {
    const { container } = wrap(<Testimonials items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('FAQ', () => {
  it('pinta las preguntas recibidas', () => {
    wrap(<FAQ items={FAQS} />)
    expect(screen.getByText('¿Pregunta de la BD?')).toBeInTheDocument()
  })

  it('abre la respuesta al pulsar', async () => {
    wrap(<FAQ items={FAQS} />)
    const btn = screen.getByRole('button', { name: /pregunta de la BD/i })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    btn.click()
    expect(await screen.findByText('Respuesta de la BD.')).toBeInTheDocument()
  })

  it('no renderiza la sección si no hay preguntas', () => {
    const { container } = wrap(<FAQ items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
