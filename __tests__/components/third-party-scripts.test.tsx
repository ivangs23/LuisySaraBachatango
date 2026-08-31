// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

const consentMock = vi.fn()
vi.mock('@/context/ConsentContext', () => ({
  useConsent: () => consentMock(),
}))

vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) =>
    <script data-testid={id ?? 'inline'} data-src={src ?? ''} />,
}))

import ThirdPartyScripts from '@/components/ThirdPartyScripts'

const OLD_ENV = { ...process.env }

describe('ThirdPartyScripts', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST123'
    process.env.NEXT_PUBLIC_META_PIXEL_ID = '99999'
  })
  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('no carga nada sin consentimiento', () => {
    consentMock.mockReturnValue({ state: null, hydrated: true })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelectorAll('script')).toHaveLength(0)
  })

  it('no carga nada antes de hidratar', () => {
    consentMock.mockReturnValue({
      state: { v: 1, analytics: true, marketing: true, at: 'x' },
      hydrated: false,
    })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelectorAll('script')).toHaveLength(0)
  })

  it('no carga nada si ambas categorías están denegadas', () => {
    consentMock.mockReturnValue({
      state: { v: 1, analytics: false, marketing: false, at: 'x' },
      hydrated: true,
    })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelectorAll('script')).toHaveLength(0)
  })

  it('carga GA4 solo con analytics concedido', () => {
    consentMock.mockReturnValue({
      state: { v: 1, analytics: true, marketing: false, at: 'x' },
      hydrated: true,
    })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelector('[data-testid="ga4-src"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="meta-pixel"]')).toBeNull()
  })

  it('carga el Pixel solo con marketing concedido', () => {
    consentMock.mockReturnValue({
      state: { v: 1, analytics: false, marketing: true, at: 'x' },
      hydrated: true,
    })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelector('[data-testid="meta-pixel"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="ga4-src"]')).toBeNull()
  })

  it('no carga GA4 si falta el measurement id (fail-closed)', () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    consentMock.mockReturnValue({
      state: { v: 1, analytics: true, marketing: false, at: 'x' },
      hydrated: true,
    })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelector('[data-testid="ga4-src"]')).toBeNull()
  })

  it('no carga el Pixel si falta el pixel id (fail-closed)', () => {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID
    consentMock.mockReturnValue({
      state: { v: 1, analytics: false, marketing: true, at: 'x' },
      hydrated: true,
    })
    const { container } = render(<ThirdPartyScripts />)
    expect(container.querySelector('[data-testid="meta-pixel"]')).toBeNull()
  })
})
