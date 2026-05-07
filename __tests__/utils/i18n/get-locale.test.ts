import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const cookiesGet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: cookiesGet }),
}))

import { getCurrentLocale } from '@/utils/i18n/get-locale'

describe('getCurrentLocale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns es by default if no cookie', async () => {
    cookiesGet.mockReturnValue(undefined)
    expect(await getCurrentLocale()).toBe('es')
  })

  it('returns the locale from cookie when valid', async () => {
    cookiesGet.mockReturnValue({ value: 'en' })
    expect(await getCurrentLocale()).toBe('en')
  })

  it('returns es for invalid locale', async () => {
    cookiesGet.mockReturnValue({ value: 'klingon' })
    expect(await getCurrentLocale()).toBe('es')
  })

  it('validates all supported locales', async () => {
    const locales = ['es', 'en', 'fr', 'de', 'it', 'ja']
    for (const locale of locales) {
      cookiesGet.mockReturnValue({ value: locale })
      expect(await getCurrentLocale()).toBe(locale)
    }
  })

  it('returns es for empty string', async () => {
    cookiesGet.mockReturnValue({ value: '' })
    expect(await getCurrentLocale()).toBe('es')
  })

  it('returns es for null value', async () => {
    cookiesGet.mockReturnValue({ value: null })
    expect(await getCurrentLocale()).toBe('es')
  })
})
