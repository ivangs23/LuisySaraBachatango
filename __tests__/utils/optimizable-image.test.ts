import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isOptimizableImageUrl } from '@/utils/images/optimizable'

const ORIGINAL = process.env.NEXT_PUBLIC_SUPABASE_URL

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://jytokoxbsykoyifzbjkd.supabase.co'
})
afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL
})

describe('isOptimizableImageUrl', () => {
  it('acepta un objeto público del bucket de Supabase', () => {
    expect(isOptimizableImageUrl(
      'https://jytokoxbsykoyifzbjkd.supabase.co/storage/v1/object/public/thumbnails/course-covers/a.png',
    )).toBe(true)
  })

  it('rechaza otro host aunque sea https', () => {
    expect(isOptimizableImageUrl('https://evil.example.com/a.png')).toBe(false)
  })

  it('rechaza http', () => {
    expect(isOptimizableImageUrl(
      'http://jytokoxbsykoyifzbjkd.supabase.co/storage/v1/object/public/thumbnails/a.png',
    )).toBe(false)
  })

  it('rechaza una ruta privada del mismo host', () => {
    expect(isOptimizableImageUrl(
      'https://jytokoxbsykoyifzbjkd.supabase.co/storage/v1/object/sign/thumbnails/a.png',
    )).toBe(false)
  })

  it('rechaza null, vacío y basura', () => {
    expect(isOptimizableImageUrl(null)).toBe(false)
    expect(isOptimizableImageUrl('')).toBe(false)
    expect(isOptimizableImageUrl('no-es-una-url')).toBe(false)
  })

  it('rechaza todo si falta NEXT_PUBLIC_SUPABASE_URL', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    expect(isOptimizableImageUrl(
      'https://jytokoxbsykoyifzbjkd.supabase.co/storage/v1/object/public/thumbnails/a.png',
    )).toBe(false)
  })
})
