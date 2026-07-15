// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/app/curso-bachatango/comprar/actions', () => ({ landingCheckout: vi.fn() }))
import LandingCheckoutForm from '@/components/LandingCheckoutForm'

describe('LandingCheckoutForm', () => {
  it('renders all required registration fields', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    for (const name of ['fullName', 'email', 'password', 'repeatPassword', 'country', 'city', 'postalCode', 'dateOfBirth', 'danceLevel', 'phone', 'acceptTerms']) {
      expect(document.querySelector(`[name="${name}"]`)).toBeTruthy()
    }
    expect(document.querySelector('[name="marketingConsent"]')).toBeTruthy()
  })
  it('password inputs are type=password and NOT pre-filled from any value', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="ana@x.com" defaultName="Ana" error="password_mismatch" />)
    const pw = document.querySelector('[name="password"]') as HTMLInputElement
    const rpw = document.querySelector('[name="repeatPassword"]') as HTMLInputElement
    expect(pw.type).toBe('password')
    expect(pw.value).toBe('')
    expect(rpw.value).toBe('')
  })
  it('shows a specific message for the error code', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" error="password_weak" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/may[uú]scula/i)
  })
  it('acceptTerms is required and marketingConsent is not', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    expect((document.querySelector('[name="acceptTerms"]') as HTMLInputElement).required).toBe(true)
    expect((document.querySelector('[name="marketingConsent"]') as HTMLInputElement).required).toBe(false)
  })
  it('announces the error message via role="alert" when an error prop is passed', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" error="password_weak" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert.id).toBe('lc-form-error')
  })
  it('applies defaults to re-echoed fields without touching password fields', () => {
    render(
      <LandingCheckoutForm
        courseId="c1"
        defaultEmail=""
        defaultName=""
        defaults={{ country: 'ES', city: 'Madrid', postalCode: '28001', dateOfBirth: '1990-01-01', danceLevel: 'intermedio', phone: '+34600123456' }}
      />
    )
    expect((document.querySelector('[name="country"]') as HTMLSelectElement).value).toBe('ES')
    expect((document.querySelector('[name="city"]') as HTMLInputElement).value).toBe('Madrid')
    expect((document.querySelector('[name="password"]') as HTMLInputElement).value).toBe('')
  })
  it('toggles both password fields visibility', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    const pw = document.querySelector('[name="password"]') as HTMLInputElement
    const pw2 = document.querySelector('[name="repeatPassword"]') as HTMLInputElement
    expect(pw.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: /mostrar contrase/i }))
    expect(pw.type).toBe('text')
    expect(pw2.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: /ocultar contrase/i }))
    expect(pw.type).toBe('password')
  })
})
