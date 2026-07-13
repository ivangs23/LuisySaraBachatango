// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/app/curso-bachatango/comprar/actions', () => ({ landingCheckout: vi.fn() }))
import LandingCheckoutForm from '@/components/LandingCheckoutForm'

describe('LandingCheckoutForm', () => {
  it('renders all required registration fields', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    for (const name of ['fullName', 'email', 'password', 'repeatPassword', 'country', 'city', 'dateOfBirth', 'danceLevel', 'phone', 'acceptTerms']) {
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
    expect(screen.getByText(/may[uú]scula/i)).toBeInTheDocument()
  })
  it('acceptTerms is required and marketingConsent is not', () => {
    render(<LandingCheckoutForm courseId="c1" defaultEmail="" defaultName="" />)
    expect((document.querySelector('[name="acceptTerms"]') as HTMLInputElement).required).toBe(true)
    expect((document.querySelector('[name="marketingConsent"]') as HTMLInputElement).required).toBe(false)
  })
})
