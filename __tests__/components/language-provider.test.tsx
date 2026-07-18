// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { LanguageProvider, useLanguage } from '@/context/LanguageContext'

function Probe() { const { locale } = useLanguage(); return <span data-testid="loc">{locale}</span> }

describe('LanguageProvider initialLocale', () => {
  it('uses the server-provided initialLocale on first render (no localStorage read)', () => {
    const { getByTestId } = render(<LanguageProvider initialLocale="en"><Probe /></LanguageProvider>)
    expect(getByTestId('loc').textContent).toBe('en')
  })
  it('defaults to es when no initialLocale given', () => {
    const { getByTestId } = render(<LanguageProvider><Probe /></LanguageProvider>)
    expect(getByTestId('loc').textContent).toBe('es')
  })
})
