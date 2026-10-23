// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayCircle } from 'lucide-react'
import LandingRateCard from '@/components/admin/LandingRateCard'

// KPI del plan de marketing en /admin/landing: reproducciones de la clase
// gratis y emails capturados, cada uno frente a las visitas a la landing.
describe('LandingRateCard', () => {
  it('enseña cuántos lo hicieron y qué parte de la landing es', () => {
    render(
      <LandingRateCard
        label="Reproducciones de la clase gratis"
        Icon={PlayCircle}
        data={{ events: 9, viewers: 7, landingVisitors: 40, rate: 17.5 }}
      />,
    )
    expect(screen.getByText('Reproducciones de la clase gratis')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('17,5 % de quienes vieron la landing (7 de 40)')).toBeInTheDocument()
  })

  it('sin visitas a la landing no inventa un porcentaje', () => {
    render(
      <LandingRateCard
        label="Emails capturados"
        Icon={PlayCircle}
        data={{ events: 0, viewers: 0, landingVisitors: 0, rate: null }}
      />,
    )
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('Sin visitas a la landing en este rango')).toBeInTheDocument()
  })
})
