import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: 'admin' }) }))

type Op = { name: string; args: unknown[] }
type Call = { table: string; ops: Op[] }

let calls: Call[] = []

function chainFor(table: string): unknown {
  const call: Call = { table, ops: [] }
  calls.push(call)
  const settle = () => Promise.resolve({ data: [], error: null, count: 0 })
  const chain: unknown = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (ok: (v: unknown) => unknown, err: (e: unknown) => unknown) => settle().then(ok, err)
      }
      return (...args: unknown[]) => { call.ops.push({ name: prop, args }); return chain }
    },
  })
  return chain
}

vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({ from: (t: string) => chainFor(t) }),
}))

import {
  getOverviewKpis,
  getRecentPayments,
  getRevenueTimeseries,
  getStatsIncomeByMonth,
  getStatsTopCourses,
  listCoursesWithStats,
  getStudentDetail,
} from '@/utils/admin/queries'

/** Toda llamada a course_purchases de esta ejecución. */
function purchaseCalls(): Call[] {
  return calls.filter(c => c.table === 'course_purchases')
}

function filtersOf(call: Call): { refunded: boolean; demo: boolean } {
  return {
    refunded: call.ops.some(o => o.name === 'is' && o.args[0] === 'refunded_at' && o.args[1] === null),
    demo: call.ops.some(o => o.name === 'eq' && o.args[0] === 'is_demo' && o.args[1] === false),
  }
}

beforeEach(() => { calls = [] })

/**
 * Ninguna consulta de negocio filtraba `refunded_at` ni `is_demo`, y una compra
 * demo escribe el PRECIO COMPLETO (app/api/checkout/route.ts:61) con
 * `is_demo: true`. Una sola prueba desde /admin/pruebas inflaba los ingresos de
 * por vida, y un reembolso seguía contando como venta para siempre.
 */
describe('cifras del panel: solo dinero real', () => {
  const casos: Array<[string, () => Promise<unknown>]> = [
    ['getOverviewKpis', () => getOverviewKpis()],
    ['getRecentPayments', () => getRecentPayments()],
    ['getRevenueTimeseries', () => getRevenueTimeseries(30)],
    ['getStatsIncomeByMonth', () => getStatsIncomeByMonth(90)],
    ['getStatsTopCourses', () => getStatsTopCourses()],
    ['listCoursesWithStats', () => listCoursesWithStats()],
  ]

  for (const [nombre, ejecutar] of casos) {
    it(`${nombre} descarta reembolsos y compras de prueba`, async () => {
      await ejecutar()
      const compras = purchaseCalls()
      expect(compras.length).toBeGreaterThan(0)
      for (const c of compras) {
        expect(filtersOf(c)).toEqual({ refunded: true, demo: true })
      }
    })
  }

  /**
   * La excepción deliberada: un admin mirando la ficha de un alumno necesita
   * ver que se le reembolsó. Ocultarlo ahí sería mentirle sobre su propio
   * historial.
   */
  it('getStudentDetail SÍ muestra las compras reembolsadas', async () => {
    await getStudentDetail('u1')
    const compras = purchaseCalls()
    expect(compras.length).toBeGreaterThan(0)
    for (const c of compras) {
      expect(filtersOf(c).refunded).toBe(false)
    }
  })
})
