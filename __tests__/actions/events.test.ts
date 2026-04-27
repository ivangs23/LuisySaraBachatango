import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRevalidatePath, mockRedirect, mockRequireAdmin, mockFrom } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockRedirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
  mockRequireAdmin: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/utils/admin/guard', () => ({
  requireAdmin: mockRequireAdmin,
  AdminGuardError: class AdminGuardError extends Error {
    constructor(public reason: string) { super(reason) }
  },
}))

// Supabase mock — built per-test
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAdmin.mockResolvedValue({ id: 'admin-user-id' })
})

// ── parseEventForm ────────────────────────────────────────────────────────────

import { parseEventForm } from '@/app/events/_lib/parse'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  fd.set('start_date', '2026-06-01')
  fd.set('end_date', '2026-06-03')
  fd.set('location', 'Madrid, España')
  fd.set('is_published', 'on')
  fd.set('title_es', 'Festival Test')
  fd.set('title_en', '')
  fd.set('title_fr', '')
  fd.set('title_de', '')
  fd.set('title_it', '')
  fd.set('title_ja', '')
  fd.set('description_es', 'Descripción del festival')
  fd.set('description_en', '')
  fd.set('description_fr', '')
  fd.set('description_de', '')
  fd.set('description_it', '')
  fd.set('description_ja', '')
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v)
  return fd
}

describe('parseEventForm', () => {
  it('returns parsed payload when all required fields are present', () => {
    const result = parseEventForm(buildFormData())
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.payload.start_date).toBe('2026-06-01')
    expect(result.payload.end_date).toBe('2026-06-03')
    expect(result.payload.location).toBe('Madrid, España')
    expect(result.payload.is_published).toBe(true)
    expect(result.payload.title).toEqual({
      es: 'Festival Test', en: '', fr: '', de: '', it: '', ja: '',
    })
    expect(result.payload.description.es).toBe('Descripción del festival')
  })

  it('rejects when start_date is missing', () => {
    const result = parseEventForm(buildFormData({ start_date: '' }))
    expect('error' in result && result.error).toMatch(/fecha/i)
  })

  it('rejects when end_date is before start_date', () => {
    const fd = buildFormData({ start_date: '2026-06-05', end_date: '2026-06-01' })
    const result = parseEventForm(fd)
    expect('error' in result && result.error).toMatch(/posterior|igual|after/i)
  })

  it('accepts when start_date equals end_date', () => {
    const fd = buildFormData({ start_date: '2026-06-05', end_date: '2026-06-05' })
    const result = parseEventForm(fd)
    expect('error' in result).toBe(false)
  })

  it('rejects when location is empty after trim', () => {
    const result = parseEventForm(buildFormData({ location: '   ' }))
    expect('error' in result && result.error).toMatch(/ubicación|location/i)
  })

  it('rejects when title_es is empty after trim', () => {
    const result = parseEventForm(buildFormData({ title_es: '   ' }))
    expect('error' in result && result.error).toMatch(/título|title/i)
  })

  it('rejects when description_es is empty after trim', () => {
    const result = parseEventForm(buildFormData({ description_es: '' }))
    expect('error' in result && result.error).toMatch(/descripción|description/i)
  })

  it('treats missing is_published as false (draft)', () => {
    const fd = buildFormData()
    fd.delete('is_published')
    const result = parseEventForm(fd)
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.payload.is_published).toBe(false)
  })

  it('rejects malformed dates', () => {
    const result = parseEventForm(buildFormData({ start_date: 'not-a-date' }))
    expect('error' in result && result.error).toMatch(/fecha|date/i)
  })

  it('rejects impossible calendar dates (Feb 30, month 13)', () => {
    const r1 = parseEventForm(buildFormData({ start_date: '2026-02-30' }))
    expect('error' in r1 && r1.error).toMatch(/fecha|date/i)
    const r2 = parseEventForm(buildFormData({ start_date: '2026-13-01' }))
    expect('error' in r2 && r2.error).toMatch(/fecha|date/i)
  })
})
