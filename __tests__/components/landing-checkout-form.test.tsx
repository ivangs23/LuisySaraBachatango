// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/app/curso-bachatango/comprar/actions', () => ({ landingCheckout: vi.fn() }))
import LandingCheckoutForm from '@/components/LandingCheckoutForm'

describe('LandingCheckoutForm — formulario mínimo', () => {
  it('pide exactamente nombre y email', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    // Coincidencia exacta: una búsqueda difusa (/email/i) también encuentra la
    // casilla de marketing, que menciona "email" en su propio texto.
    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument()
  })

  it('no pide ninguno de los campos que nadie leía', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    for (const etiqueta of [/país/i, /ciudad/i, /postal/i, /nacimiento/i, /nivel/i, /teléfono/i]) {
      expect(screen.queryByLabelText(etiqueta)).not.toBeInTheDocument()
    }
  })

  it('mantiene las tres casillas, y la de ejecución inmediata aparte', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    expect(screen.getByRole('checkbox', { name: /16/ })).toBeRequired()
    expect(screen.getByRole('checkbox', { name: /condiciones/i })).toBeRequired()
    expect(screen.getByRole('checkbox', { name: /acceso inmediato|ejecución/i })).toBeRequired()
  })

  it('muestra el error de edad que devuelve el servidor', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" error="age_required" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/16/)
  })

  it('renderiza exactamente los campos esperados por name', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    for (const name of ['courseId', 'fullName', 'email', 'isAdult', 'acceptTerms', 'acceptDigitalExecution', 'marketingConsent']) {
      expect(document.querySelector(`[name="${name}"]`)).toBeTruthy()
    }
  })

  it('prellena nombre y email para un usuario ya identificado', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="ana@x.com" defaultName="Ana" />)
    expect((document.querySelector('[name="fullName"]') as HTMLInputElement).value).toBe('Ana')
    expect((document.querySelector('[name="email"]') as HTMLInputElement).value).toBe('ana@x.com')
  })

  it('marketingConsent no es obligatoria, el resto de casillas sí', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    expect((document.querySelector('[name="marketingConsent"]') as HTMLInputElement).required).toBe(false)
  })
})
