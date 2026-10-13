// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/app/curso-bachatango/comprar/actions', () => ({ landingCheckout: vi.fn() }))
import { ConsentProvider } from '@/context/ConsentContext'
import LandingCheckoutForm from '@/components/LandingCheckoutForm'

/**
 * El formulario dispara InitiateCheckout, así que necesita el contexto de
 * consentimiento. Sin proveedor, `useConsent` lanza.
 */
function renderForm(props: Partial<React.ComponentProps<typeof LandingCheckoutForm>> = {}) {
  return render(
    <ConsentProvider>
      <LandingCheckoutForm
        courseId="c1"
        defaultEmail=""
        defaultName=""
        price={119}
        courseTitle="CURSO BACHATANGO"
        fbclid=""
        {...props}
      />
    </ConsentProvider>,
  )
}

describe('LandingCheckoutForm — formulario mínimo', () => {
  it('pide exactamente nombre y email', () => {
    renderForm()
    // Coincidencia exacta: una búsqueda difusa (/email/i) también encuentra la
    // casilla de marketing, que menciona "email" en su propio texto.
    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument()
  })

  it('no pide ninguno de los campos que nadie leía', () => {
    renderForm()
    for (const etiqueta of [/país/i, /ciudad/i, /postal/i, /nacimiento/i, /nivel/i, /teléfono/i]) {
      expect(screen.queryByLabelText(etiqueta)).not.toBeInTheDocument()
    }
  })

  it('mantiene las tres casillas, y la de ejecución inmediata aparte', () => {
    renderForm()
    expect(screen.getByRole('checkbox', { name: /16/ })).toBeRequired()
    expect(screen.getByRole('checkbox', { name: /condiciones/i })).toBeRequired()
    expect(screen.getByRole('checkbox', { name: /acceso inmediato|ejecución/i })).toBeRequired()
  })

  it('muestra el error de edad que devuelve el servidor', () => {
    renderForm({ error: 'age_required' })
    expect(screen.getByRole('alert')).toHaveTextContent(/16/)
  })

  it('renderiza exactamente los campos esperados por name', () => {
    renderForm()
    for (const name of ['courseId', 'fullName', 'email', 'isAdult', 'acceptTerms', 'acceptDigitalExecution', 'marketingConsent']) {
      expect(document.querySelector(`[name="${name}"]`)).toBeTruthy()
    }
  })

  it('prellena nombre y email para un usuario ya identificado', () => {
    renderForm({ defaultEmail: 'ana@x.com', defaultName: 'Ana' })
    expect((document.querySelector('[name="fullName"]') as HTMLInputElement).value).toBe('Ana')
    expect((document.querySelector('[name="email"]') as HTMLInputElement).value).toBe('ana@x.com')
  })

  it('marketingConsent no es obligatoria, el resto de casillas sí', () => {
    renderForm()
    expect((document.querySelector('[name="marketingConsent"]') as HTMLInputElement).required).toBe(false)
  })
})
