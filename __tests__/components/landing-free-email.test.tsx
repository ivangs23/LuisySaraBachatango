// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/app/actions/free-classes', () => ({ requestFreeClasses: vi.fn() }))
vi.mock('@/context/ConsentContext', () => ({ useConsent: () => ({ state: null, hydrated: true }) }))

import { render, screen } from '@testing-library/react'
import { getLandingCopy } from '@/app/curso-bachatango/copy'
import LandingSections from '@/app/curso-bachatango/_components/LandingSections'
import StickyBuyBar from '@/app/curso-bachatango/_components/StickyBuyBar'
import { buildOffer } from '@/utils/courses/offer'

const COPY = getLandingCopy('es')
const OFFER = buildOffer({ price_eur: 119 })

describe('formulario «dos clases más por email» en la landing', () => {
  it('va dentro de la sección de la clase gratis, justo debajo del vídeo', () => {
    const { container } = render(
      <LandingSections copy={COPY} courseId="c1" offer={OFFER} curriculum={null} freeClass={null} testimonials={[]} />,
    )
    const seccion = container.querySelector('#clase-gratis')!
    const form = seccion.querySelector('#clases-por-email')
    expect(form).not.toBeNull()
    expect(form).toHaveTextContent(COPY.freeEmail.title)
    // Antes que la fila de garantías: es lo siguiente que ve quien acaba de ver la clase.
    const garantias = seccion.querySelector('ul')!
    expect(form!.compareDocumentPosition(garantias) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('la barra fija ofrece una segunda salida que lleva al formulario', () => {
    render(<StickyBuyBar copy={COPY} courseId="c1" offer={OFFER} />)
    expect(screen.getByRole('link', { name: 'Clase gratis por email', hidden: true }))
      .toHaveAttribute('href', '#clases-por-email')
  })
})
