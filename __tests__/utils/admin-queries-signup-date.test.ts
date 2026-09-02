import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: 'admin' }) }))

/**
 * Registro de la cadena PostgREST: cada `from()` abre una llamada y cada método
 * encadenado se apunta. Así los tests afirman sobre QUÉ columna se filtra y se
 * ordena, que es exactamente lo que este cambio corrige.
 */
type Op = { name: string; args: unknown[] }
type Call = { table: string; ops: Op[] }

let calls: Call[] = []
let resultByTable: Record<string, unknown> = {}

function chainFor(table: string): unknown {
  const call: Call = { table, ops: [] }
  calls.push(call)

  const settle = () =>
    Promise.resolve(resultByTable[table] ?? { data: [], error: null, count: 0 })

  const chain: unknown = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (onOk: (v: unknown) => unknown, onErr: (e: unknown) => unknown) =>
            settle().then(onOk, onErr)
        }
        return (...args: unknown[]) => {
          call.ops.push({ name: prop, args })
          return chain
        }
      },
    },
  )
  return chain
}

vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({ from: (table: string) => chainFor(table) }),
}))

import {
  getOverviewKpis,
  getLatestStudents,
  listStudents,
  getStatsSignupsByMonth,
} from '@/utils/admin/queries'

/** Columnas usadas por el primer `.gte()`/`.order()` de cada llamada a una tabla. */
function opsFor(table: string): Call[] {
  return calls.filter(c => c.table === table)
}
function columnsOf(call: Call, op: string): string[] {
  return call.ops.filter(o => o.name === op).map(o => String(o.args[0]))
}

beforeEach(() => {
  calls = []
  resultByTable = {}
})

describe('altas de alumnos: se miden por created_at, no por updated_at', () => {
  it('getOverviewKpis cuenta los nuevos de la semana y del día por created_at', async () => {
    await getOverviewKpis()

    const profileCalls = opsFor('profiles')
    const filtrados = profileCalls.filter(c => c.ops.some(o => o.name === 'gte'))

    expect(filtrados).toHaveLength(2)
    for (const call of filtrados) {
      expect(columnsOf(call, 'gte')).toEqual(['created_at'])
    }
  })

  it('getLatestStudents pide y ordena por created_at', async () => {
    resultByTable.profiles = {
      data: [{ id: 'u1', full_name: 'Ana', email: 'a@x.es', avatar_url: null, created_at: '2026-09-01T10:00:00Z' }],
      error: null,
    }

    const rows = await getLatestStudents()

    const call = opsFor('profiles')[0]
    expect(String(call.ops.find(o => o.name === 'select')?.args[0])).toContain('created_at')
    expect(columnsOf(call, 'order')).toEqual(['created_at'])
    expect(rows[0].created_at).toBe('2026-09-01T10:00:00Z')
  })

  it('getStatsSignupsByMonth agrupa por created_at', async () => {
    resultByTable.profiles = {
      data: [{ created_at: '2026-08-15T10:00:00Z' }, { created_at: '2026-08-20T10:00:00Z' }],
      error: null,
    }

    const rows = await getStatsSignupsByMonth(90)

    const call = opsFor('profiles')[0]
    expect(String(call.ops.find(o => o.name === 'select')?.args[0])).toBe('created_at')
    expect(columnsOf(call, 'gte')).toEqual(['created_at'])
    expect(rows.reduce((s, r) => s + r.value, 0)).toBe(2)
  })

  it('listStudents filtra «nuevos este mes» por created_at', async () => {
    await listStudents({ sub: 'newMonth' })

    const call = opsFor('profiles')[0]
    expect(columnsOf(call, 'gte')).toEqual(['created_at'])
  })

  it('listStudents ordena por created_at cuando se pide por antigüedad', async () => {
    await listStudents({ sort: 'created' })
    expect(columnsOf(opsFor('profiles')[0], 'order')).toEqual(['created_at'])
  })

  it('listStudents sigue ordenando por updated_at cuando se pide por actividad reciente', async () => {
    await listStudents({ sort: 'recent' })
    expect(columnsOf(opsFor('profiles')[0], 'order')).toEqual(['updated_at'])
  })

  it('listStudents distingue el alta de la última actividad', async () => {
    resultByTable.profiles = {
      data: [{
        id: 'u1', full_name: 'Ana', email: 'a@x.es', avatar_url: null, role: 'member',
        created_at: '2026-08-01T09:00:00Z',
        updated_at: '2026-09-02T09:00:00Z',
      }],
      error: null,
      count: 1,
    }

    const { rows } = await listStudents({})

    expect(rows[0].created_at).toBe('2026-08-01T09:00:00Z')
    expect(rows[0].lastActivity).toBe('2026-09-02T09:00:00Z')
  })

  it('listStudents pide ambas columnas: sin created_at el alta volvería a ser un proxy', async () => {
    await listStudents({})
    const select = String(opsFor('profiles')[0].ops.find(o => o.name === 'select')?.args[0])
    expect(select).toContain('created_at')
    expect(select).toContain('updated_at')
  })
})
