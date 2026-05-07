// __tests__/utils/sanitize.test.ts
import { describe, it, expect } from 'vitest'
import { safeSocialUrl } from '@/utils/sanitize'

describe('safeSocialUrl', () => {
  it('accepts canonical Instagram hosts', () => {
    expect(safeSocialUrl('https://instagram.com/luis', 'instagram')).toBe('https://instagram.com/luis')
    expect(safeSocialUrl('https://www.instagram.com/luis', 'instagram')).toBe('https://www.instagram.com/luis')
  })

  it('rejects Instagram URL on a non-instagram host', () => {
    expect(safeSocialUrl('https://evil.com/instagram-fake', 'instagram')).toBeNull()
    expect(safeSocialUrl('https://instagrarn.com/x', 'instagram')).toBeNull()
  })

  it('accepts Facebook canonical and m.facebook', () => {
    expect(safeSocialUrl('https://facebook.com/luis', 'facebook')).toBe('https://facebook.com/luis')
    expect(safeSocialUrl('https://www.facebook.com/luis', 'facebook')).toBe('https://www.facebook.com/luis')
    expect(safeSocialUrl('https://m.facebook.com/luis', 'facebook')).toBe('https://m.facebook.com/luis')
  })

  it('accepts TikTok canonical', () => {
    expect(safeSocialUrl('https://www.tiktok.com/@luis', 'tiktok')).toBe('https://www.tiktok.com/@luis')
    expect(safeSocialUrl('https://tiktok.com/@luis', 'tiktok')).toBe('https://tiktok.com/@luis')
  })

  it('accepts YouTube canonical hosts', () => {
    expect(safeSocialUrl('https://youtube.com/@luis', 'youtube')).toBe('https://youtube.com/@luis')
    expect(safeSocialUrl('https://www.youtube.com/@luis', 'youtube')).toBe('https://www.youtube.com/@luis')
    expect(safeSocialUrl('https://youtu.be/abc', 'youtube')).toBe('https://youtu.be/abc')
  })

  it('rejects http (non-https)', () => {
    expect(safeSocialUrl('http://instagram.com/luis', 'instagram')).toBeNull()
  })

  it('rejects empty / null', () => {
    expect(safeSocialUrl(null, 'instagram')).toBeNull()
    expect(safeSocialUrl('', 'instagram')).toBeNull()
  })
})
