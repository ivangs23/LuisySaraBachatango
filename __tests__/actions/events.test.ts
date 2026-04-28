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

// ── createEvent ───────────────────────────────────────────────────────────────

import { createEvent } from '@/app/events/actions'

describe('createEvent', () => {
  it('inserts the row, revalidates paths, and redirects to /admin/eventos on success', async () => {
    const insertSingle = vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insertFn = vi.fn().mockReturnValue({ select: insertSelect })
    mockFrom.mockReturnValue({ insert: insertFn })

    const fd = buildFormData()

    const url = await createEvent(fd).catch((err: Error) => err.message)

    expect(insertFn).toHaveBeenCalledWith(expect.objectContaining({
      start_date: '2026-06-01',
      end_date: '2026-06-03',
      location: 'Madrid, España',
      is_published: true,
    }))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/eventos')
    expect(url).toBe('REDIRECT:/admin/eventos')
  })

  it('returns { error: "No autorizado" } when not admin', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const fd = buildFormData()
    const result = await createEvent(fd)
    expect(result).toEqual({ error: 'No autorizado' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns validation { error } and skips DB write', async () => {
    const fd = buildFormData({ title_es: '' })
    const result = await createEvent(fd)
    expect(result && 'error' in result).toBe(true)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns DB error message when Supabase insert errors', async () => {
    const insertSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'db boom' } })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insertFn = vi.fn().mockReturnValue({ select: insertSelect })
    mockFrom.mockReturnValue({ insert: insertFn })

    const result = await createEvent(buildFormData())
    expect(result).toEqual({ error: 'db boom' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})

// ── updateEvent ───────────────────────────────────────────────────────────────

import { updateEvent } from '@/app/events/actions'

describe('updateEvent', () => {
  it('updates the row by id, revalidates, and redirects to /admin/eventos', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
    mockFrom.mockReturnValue({ update: updateFn })

    const fd = buildFormData()
    const url = await updateEvent('event-123', fd).catch((err: Error) => err.message)

    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({
      start_date: '2026-06-01',
      location: 'Madrid, España',
    }))
    expect(eqFn).toHaveBeenCalledWith('id', 'event-123')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/eventos')
    expect(url).toBe('REDIRECT:/admin/eventos')
  })

  it('returns { error: "No autorizado" } when not admin', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const result = await updateEvent('id-1', buildFormData())
    expect(result).toEqual({ error: 'No autorizado' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns validation { error } and skips DB write', async () => {
    const result = await updateEvent('id-1', buildFormData({ description_es: '' }))
    expect(result && 'error' in result).toBe(true)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns DB error message when update fails', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'update failed' } })
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn })
    mockFrom.mockReturnValue({ update: updateFn })

    const result = await updateEvent('id-1', buildFormData())
    expect(result).toEqual({ error: 'update failed' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})

// ── deleteEvent ───────────────────────────────────────────────────────────────

import { deleteEvent } from '@/app/events/actions'

describe('deleteEvent', () => {
  it('deletes the row by id and revalidates the public + admin paths', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null })
    const deleteFn = vi.fn().mockReturnValue({ eq: eqFn })
    mockFrom.mockReturnValue({ delete: deleteFn })

    const result = await deleteEvent('event-xyz')

    expect(deleteFn).toHaveBeenCalled()
    expect(eqFn).toHaveBeenCalledWith('id', 'event-xyz')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/events')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/eventos')
    expect(result).toBeUndefined()
  })

  it('returns { error } when not admin', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error('forbidden'))
    const result = await deleteEvent('event-xyz')
    expect(result).toEqual({ error: 'No autorizado' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns DB error message when delete fails', async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: { message: 'delete failed' } })
    const deleteFn = vi.fn().mockReturnValue({ eq: eqFn })
    mockFrom.mockReturnValue({ delete: deleteFn })

    const result = await deleteEvent('event-xyz')
    expect(result).toEqual({ error: 'delete failed' })
  })
})
