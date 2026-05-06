import { describe, it, expect } from 'vitest'
import { isSafeRedirect } from '@/app/auth/callback/redirect'

describe('isSafeRedirect', () => {
  it.each<[string | null | undefined, boolean]>([
    ['/', true],
    ['/dashboard', true],
    ['/dashboard/', true],
    ['/dashboard/x', true],
    ['/profile?tab=2', true],
    ['/courses#anchor', true],
    ['/community/posts', true],
    ['/agenda', true],

    [null, false],
    [undefined, false],
    ['', false],
    ['//evil.com', false],
    ['/\\evil.com', false],
    ['/;evil.com', false],
    ['https://evil.com', false],
    ['javascript:alert(1)', false],
    ['/dashboard\nfoo', false],
    ['/unknown', false],
    ['relative', false],
  ])('returns %s for %s', (input, expected) => {
    expect(isSafeRedirect(input as string | null | undefined)).toBe(expected)
  })
})
