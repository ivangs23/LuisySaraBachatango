// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { LanguageProvider } from '@/context/LanguageContext'
import type { LandingStats } from '@/utils/landing/content'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}))

import Hero from '@/components/Hero'
import AboutClient from '@/app/sobre-nosotros/AboutClient'

const STATS: LandingStats = { years: '26', students: '600', countries: '31', titles: '101' }

describe('las cifras salen de una sola fuente', () => {
  it('el hero muestra las cifras recibidas, no unas hardcodeadas', () => {
    const { container } = render(
      <LanguageProvider initialLocale="es"><Hero stats={STATS} /></LanguageProvider>,
    )
    const hero = container.querySelector('section')!
    expect(within(hero).getByText('+26')).toBeInTheDocument()
    expect(within(hero).getByText('+600')).toBeInTheDocument()
    expect(within(hero).getByText('+31')).toBeInTheDocument()
    // Las de antes ya no pueden aparecer.
    expect(within(hero).queryByText('+25')).toBeNull()
  })

  it('sobre-nosotros muestra las mismas cifras, incluida la cuarta', () => {
    render(
      <LanguageProvider initialLocale="es"><AboutClient stats={STATS} /></LanguageProvider>,
    )
    expect(screen.getByText('26')).toBeInTheDocument()
    expect(screen.getByText('600')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
    expect(screen.getByText('101')).toBeInTheDocument()
    expect(screen.queryByText('25')).toBeNull()
  })
})
