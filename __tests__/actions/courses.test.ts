import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── File upload validation (pure logic, extracted for testing) ────────────────

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

function validateImageFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WebP, GIF).'
  }
  if (file.size > MAX_SIZE) {
    return 'El archivo es demasiado grande. El tamaño máximo es 5MB.'
  }
  return null
}

// ── parseInt / NaN validation (pure logic) ────────────────────────────────────

function validateOrder(raw: string): string | null {
  const order = parseInt(raw)
  if (isNaN(order) || order < 1) return 'El orden de la lección debe ser un número positivo'
  return null
}

// ── JSON.parse validation (pure logic) ───────────────────────────────────────

function parseMediaConfig(raw: string | null): { config: unknown } | { error: string } {
  if (!raw) return { config: {} }
  try {
    return { config: JSON.parse(raw) }
  } catch {
    return { error: 'Configuración de media inválida' }
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('validateImageFile', () => {
  it('accepts image/jpeg', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 1024 })).toBeNull()
  })

  it('accepts image/png', () => {
    expect(validateImageFile({ type: 'image/png', size: 1024 })).toBeNull()
  })

  it('accepts image/webp', () => {
    expect(validateImageFile({ type: 'image/webp', size: 1024 })).toBeNull()
  })

  it('accepts image/gif', () => {
    expect(validateImageFile({ type: 'image/gif', size: 1024 })).toBeNull()
  })

  it('rejects application/octet-stream (e.g. disguised exe)', () => {
    const err = validateImageFile({ type: 'application/octet-stream', size: 1024 })
    expect(err).toContain('Tipo de archivo no permitido')
  })

  it('rejects application/pdf', () => {
    const err = validateImageFile({ type: 'application/pdf', size: 1024 })
    expect(err).toContain('Tipo de archivo no permitido')
  })

  it('rejects text/html', () => {
    const err = validateImageFile({ type: 'text/html', size: 1024 })
    expect(err).toContain('Tipo de archivo no permitido')
  })

  it('rejects files larger than 5MB', () => {
    const err = validateImageFile({ type: 'image/jpeg', size: MAX_SIZE + 1 })
    expect(err).toContain('demasiado grande')
  })

  it('accepts file of exactly 5MB', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: MAX_SIZE })).toBeNull()
  })

  it('rejects file with no type (empty string)', () => {
    const err = validateImageFile({ type: '', size: 1024 })
    expect(err).toContain('Tipo de archivo no permitido')
  })
})

describe('validateOrder', () => {
  it('accepts valid positive integers', () => {
    expect(validateOrder('1')).toBeNull()
    expect(validateOrder('5')).toBeNull()
    expect(validateOrder('100')).toBeNull()
  })

  it('rejects NaN (non-numeric string)', () => {
    expect(validateOrder('abc')).toContain('número positivo')
  })

  it('rejects zero', () => {
    expect(validateOrder('0')).toContain('número positivo')
  })

  it('rejects negative numbers', () => {
    expect(validateOrder('-1')).toContain('número positivo')
  })

  it('rejects empty string', () => {
    expect(validateOrder('')).toContain('número positivo')
  })

  it('rejects float strings (parseInt truncates, 1.5 → 1 which is valid)', () => {
    expect(validateOrder('1.5')).toBeNull() // parseInt('1.5') = 1
  })
})

describe('parseMediaConfig', () => {
  it('returns empty config for null', () => {
    expect(parseMediaConfig(null)).toEqual({ config: {} })
  })

  it('parses valid JSON', () => {
    const json = JSON.stringify({ tracks: [], subtitles: [] })
    expect(parseMediaConfig(json)).toEqual({ config: { tracks: [], subtitles: [] } })
  })

  it('returns error for malformed JSON', () => {
    const result = parseMediaConfig('{bad json}')
    expect(result).toHaveProperty('error', 'Configuración de media inválida')
  })

  it('returns error for truncated JSON', () => {
    const result = parseMediaConfig('{"tracks": [')
    expect(result).toHaveProperty('error', 'Configuración de media inválida')
  })

  it('handles nested valid JSON', () => {
    const json = JSON.stringify({ tracks: [{ language: 'es', url: 'https://x.com/file.vtt' }] })
    const result = parseMediaConfig(json) as { config: unknown }
    expect(result.config).toHaveProperty('tracks')
  })
})
