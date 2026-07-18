import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture the argument passed to PostgREST `.or()` so we can assert the search term
// is safely quoted/escaped and cannot inject extra filter clauses.
const orArgs: string[] = []

function makeQ() {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'or', 'eq', 'gte', 'order', 'range', 'in']) {
    q[m] = vi.fn((...a: unknown[]) => {
      if (m === 'or') orArgs.push(a[0] as string)
      return q
    })
  }
  // Thenable: `await q` resolves to an empty page (no rows -> subscriptions branch skipped).
  ;(q as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ data: [], count: 0, error: null })
  return q
}

vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-1' }) }))
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({ from: () => makeQ() }) }))

beforeEach(() => { orArgs.length = 0; vi.clearAllMocks() })

describe('listStudents search filter escaping', () => {
  it('wraps the term in double quotes so PostgREST reserved chars cannot inject clauses', async () => {
    const { listStudents } = await import('@/utils/admin/queries')
    await listStudents({ q: 'a),role.eq.admin' })
    // The injected `),role.eq.admin` must stay INSIDE the quoted value, not break out.
    expect(orArgs[0]).toBe(
      'full_name.ilike."%a),role.eq.admin%",email.ilike."%a),role.eq.admin%"',
    )
  })

  it('backslash-escapes a double-quote in the term (cannot close the quoted value early)', async () => {
    const { listStudents } = await import('@/utils/admin/queries')
    await listStudents({ q: 'x"y' })
    expect(orArgs[0]).toBe('full_name.ilike."%x\\"y%",email.ilike."%x\\"y%"')
  })

  it('escapes ILIKE wildcards so they match literally', async () => {
    const { listStudents } = await import('@/utils/admin/queries')
    await listStudents({ q: '50%_off' })
    // ILIKE escape backslashes the %/_ (-> \% \_), then the PostgREST quoted-value layer
    // doubles those backslashes (\\% \\_) so PostgREST delivers a literal \% \_ to ILIKE.
    expect(orArgs[0]).toBe('full_name.ilike."%50\\\\%\\\\_off%",email.ilike."%50\\\\%\\\\_off%"')
  })
})
