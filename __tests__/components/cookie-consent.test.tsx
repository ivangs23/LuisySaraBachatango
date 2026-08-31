// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageProvider } from '@/context/LanguageContext'
import { ConsentProvider } from '@/context/ConsentContext'
import { CONSENT_COOKIE, parseConsent } from '@/utils/consent/categories'
import CookieConsent from '@/components/CookieConsent'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}))

function renderBanner() {
  return render(
    <LanguageProvider initialLocale="es">
      <ConsentProvider>
        <CookieConsent />
      </ConsentProvider>
    </LanguageProvider>,
  )
}

function currentConsent() {
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`))
  return parseConsent(m ? m[1] : null)
}

describe('CookieConsent', () => {
  beforeEach(() => {
    document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0`
  })

  it('se muestra cuando no hay decisión guardada', async () => {
    renderBanner()
    expect(await screen.findByRole('dialog', { name: /tu privacidad/i })).toBeInTheDocument()
  })

  it('"Aceptar todo" concede ambas categorías y cierra', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(await screen.findByRole('button', { name: /aceptar todo/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(currentConsent()).toMatchObject({ analytics: true, marketing: true })
  })

  it('"Rechazar" deniega ambas categorías y cierra', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(await screen.findByRole('button', { name: /^rechazar$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(currentConsent()).toMatchObject({ analytics: false, marketing: false })
  })

  it('"Configurar" permite guardar solo análisis', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(await screen.findByRole('button', { name: /configurar/i }))
    await user.click(screen.getByRole('checkbox', { name: /análisis/i }))
    await user.click(screen.getByRole('button', { name: /guardar preferencias/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(currentConsent()).toMatchObject({ analytics: true, marketing: false })
  })

  it('no se muestra si ya hay una decisión guardada', async () => {
    const user = userEvent.setup()
    const { unmount } = renderBanner()
    await user.click(await screen.findByRole('button', { name: /^rechazar$/i }))
    unmount()

    renderBanner()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('las cookies necesarias no son desactivables', async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(await screen.findByRole('button', { name: /configurar/i }))
    // Solo dos interruptores: análisis y marketing. Las necesarias no tienen.
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })
})
