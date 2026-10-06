import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `issueCompletion` es la única puerta por la que se crea un certificado: la
 * tabla no tiene policy de INSERT, así que todo lo que llega al documento lo
 * decide esta función. Lo que se prueba aquí es justo eso — que el recuento es
 * suyo y no del cliente.
 */

type Result = { data?: unknown; error?: unknown; count?: number }

const { mockGetUser, mockHasAccess, queues, inserts } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockHasAccess: vi.fn(),
  queues: new Map<string, Result[]>(),
  inserts: [] as Array<{ table: string; payload: Record<string, unknown> }>,
}))

function nextResult(table: string): Result {
  const queue = queues.get(table)
  return queue?.shift() ?? { data: null, error: null }
}

/** Builder encadenable y "thenable": cubre `.select().eq().in()` y `.maybeSingle()`. */
function makeBuilder(table: string) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    insert: (payload: Record<string, unknown>) => {
      inserts.push({ table, payload })
      return builder
    },
    maybeSingle: () => Promise.resolve(nextResult(table)),
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(nextResult(table)).then(resolve, reject),
  }
  return builder
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: () => mockGetUser() } }),
}))
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({ from: (table: string) => makeBuilder(table) }),
}))
vi.mock('@/utils/auth/course-access', () => ({
  hasCourseAccess: (...args: unknown[]) => mockHasAccess(...args),
}))

import { issueCompletion } from '@/app/courses/completion-actions'

const COURSE = 'course-1'

/** Encola las respuestas de las tres consultas del camino feliz. */
function arrange({
  existing = null as Result['data'],
  lessons = 3,
  completed = 3,
  insertError = null as { code?: string; message?: string } | null,
}) {
  queues.set('course_completions', [
    { data: existing, error: null },                       // lookup de fila existente
    { data: null, error: insertError },                    // insert
  ])
  queues.set('lessons', [
    { data: Array.from({ length: lessons }, (_, i) => ({ id: `l${i}` })), error: null },
  ])
  queues.set('lesson_progress', [{ count: completed, error: null }])
}

beforeEach(() => {
  vi.clearAllMocks()
  queues.clear()
  inserts.length = 0
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mockHasAccess.mockResolvedValue(true)
})

describe('issueCompletion — quién puede emitir', () => {
  it('rechaza a quien no ha iniciado sesión', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    arrange({})
    expect(await issueCompletion(COURSE, 'Sara García')).toEqual({ ok: false, error: 'unauthenticated' })
    expect(inserts).toHaveLength(0)
  })

  it('rechaza a quien no tiene acceso al curso', async () => {
    mockHasAccess.mockResolvedValue(false)
    arrange({})
    expect(await issueCompletion(COURSE, 'Sara García')).toEqual({ ok: false, error: 'forbidden' })
    expect(inserts).toHaveLength(0)
  })

  it('rechaza un nombre que no es un nombre', async () => {
    arrange({})
    expect(await issueCompletion(COURSE, '  🕺 ')).toEqual({ ok: false, error: 'invalid_name' })
    expect(inserts).toHaveLength(0)
  })
})

describe('issueCompletion — el 100 % lo decide el servidor', () => {
  it('rechaza al 99 %: una lección sin marcar y no hay certificado', async () => {
    arrange({ lessons: 10, completed: 9 })
    expect(await issueCompletion(COURSE, 'Sara García')).toEqual({
      ok: false, error: 'incomplete', remaining: 1,
    })
    expect(inserts).toHaveLength(0)
  })

  it('rechaza un curso sin lecciones (nada que certificar)', async () => {
    arrange({ lessons: 0, completed: 0 })
    expect(await issueCompletion(COURSE, 'Sara García')).toEqual({ ok: false, error: 'no_lessons' })
    expect(inserts).toHaveLength(0)
  })

  it('emite al 100 % y escribe el recuento del servidor, no uno del cliente', async () => {
    arrange({ lessons: 7, completed: 7 })
    expect(await issueCompletion(COURSE, '  sara   garcía  ')).toEqual({ ok: true, alreadyIssued: false })

    expect(inserts).toHaveLength(1)
    const payload = inserts[0].payload
    expect(inserts[0].table).toBe('course_completions')
    expect(payload.user_id).toBe('user-1')
    expect(payload.course_id).toBe(COURSE)
    expect(payload.lessons_total).toBe(7)
    // Nombre ya saneado y el código con el formato del CHECK.
    expect(payload.recipient_name).toBe('sara garcía')
    expect(payload.certificate_code).toMatch(/^LSB-\d{4}-[A-Z2-7]{4}$/)
    // La fecha la pone el DEFAULT de la tabla, no el cliente ni esta función.
    expect(payload).not.toHaveProperty('completed_at')
  })
})

describe('issueCompletion — idempotencia', () => {
  it('no reescribe un certificado ya emitido', async () => {
    arrange({ existing: { certificate_code: 'LSB-2026-AAAA' } })
    expect(await issueCompletion(COURSE, 'Otro Nombre')).toEqual({ ok: true, alreadyIssued: true })
    expect(inserts).toHaveLength(0)
  })

  it('trata la colisión de PK (dos pestañas a la vez) como ya emitido', async () => {
    arrange({
      lessons: 2,
      completed: 2,
      insertError: { code: '23505', message: 'duplicate key value violates unique constraint "course_completions_pkey"' },
    })
    expect(await issueCompletion(COURSE, 'Sara García')).toEqual({ ok: true, alreadyIssued: true })
  })

  it('reintenta si el código aleatorio ya existía', async () => {
    queues.set('course_completions', [
      { data: null, error: null },
      { data: null, error: { code: '23505', message: 'duplicate key ... "course_completions_code_uniq"' } },
      { data: null, error: null },
    ])
    queues.set('lessons', [{ data: [{ id: 'l0' }], error: null }])
    queues.set('lesson_progress', [{ count: 1, error: null }])

    expect(await issueCompletion(COURSE, 'Sara García')).toEqual({ ok: true, alreadyIssued: false })
    expect(inserts).toHaveLength(2)
    expect(inserts[0].payload.certificate_code).not.toBe(inserts[1].payload.certificate_code)
  })

  it('devuelve db_error ante un fallo que no es de unicidad', async () => {
    arrange({ lessons: 1, completed: 1, insertError: { code: '42P01', message: 'relation does not exist' } })
    const result = await issueCompletion(COURSE, 'Sara García')
    expect(result).toEqual({ ok: false, error: 'db_error' })
  })
})
