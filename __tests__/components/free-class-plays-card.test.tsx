// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FreeClassPlaysCard from '@/components/admin/FreeClassPlaysCard'

// KPI del plan de marketing: «reproducciones de la clase gratis / visitas a
// la landing». Se lee en /admin/landing.
describe('FreeClassPlaysCard', () => {
  it('enseña cuántos reprodujeron la clase y qué parte de la landing es', () => {
    render(<FreeClassPlaysCard data={{ plays: 9, viewers: 7, landingVisitors: 40, rate: 17.5 }} />)
    expect(screen.getByText('Reproducciones de la clase gratis')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('17,5 % de quienes vieron la landing (7 de 40)')).toBeInTheDocument()
  })

  it('sin visitas a la landing no inventa un porcentaje', () => {
    render(<FreeClassPlaysCard data={{ plays: 0, viewers: 0, landingVisitors: 0, rate: null }} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('Sin visitas a la landing en este rango')).toBeInTheDocument()
  })
})
