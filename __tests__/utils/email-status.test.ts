import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
const requireAdmin = vi.fn().mockResolvedValue({ id: 'admin' })
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: () => requireAdmin() }))

const listSentEmails = vi.fn()
vi.mock('@/utils/email/resend-log', () => ({ listSentEmails: (...a: unknown[]) => listSentEmails(...a) }))

// Cada tabla devuelve lo que se le haya puesto, sea cual sea el filtro: aquí
// se prueba el cruce con Resend, no las consultas.
let tablas: Record<string, { data: unknown[] | null; error: unknown }> = {}
const usuarios = new Map<string, { last_sign_in_at: string | null }>()
function consulta(tabla: string) {
  const b = {
    select: () => b, eq: () => b, gte: () => b, order: () => b, in: () => b,
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
      Promise.resolve(tablas[tabla] ?? { data: [], error: null }).then(ok, ko),
  }
  return b
}
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({
    from: consulta,
    auth: { admin: { getUserById: async (id: string) => ({ data: usuarios.has(id) ? { user: usuarios.get(id) } : { user: null }, error: null }) } },
  }),
}))

import { getEmailPanel, getEmailAviso } from '@/utils/admin/email-status'
import { PURCHASE_CONFIRMATION_SUBJECT } from '@/utils/email/purchase-confirmation'
import { FREE_CLASSES_SUBJECT } from '@/utils/email/sequences/nutricion'

const AHORA = Date.parse('2026-10-27T10:00:00Z')
const haceMin = (m: number) => new Date(AHORA - m * 60_000).toISOString()
const haceDias = (d: number) => haceMin(d * 24 * 60)

function compra(id: string, extra: Record<string, unknown> = {}) {
  return { id, user_id: `u-${id}`, course_id: 'c1', created_at: haceDias(2), source: 'landing', refunded_at: null, ...extra }
}
function enviado(to: string, subject: string, createdAt: string, lastEvent = 'delivered') {
  return { id: `e-${to}-${createdAt}`, to: [to], subject, createdAt: Date.parse(createdAt), lastEvent }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(AHORA)
  requireAdmin.mockResolvedValue({ id: 'admin' })
  usuarios.clear()
  tablas = {
    course_purchases: { data: [], error: null },
    newsletter_subscribers: { data: [], error: null },
    profiles: { data: [], error: null },
    courses: { data: [{ id: 'c1', title: 'CURSO BACHATANGO' }], error: null },
  }
  listSentEmails.mockResolvedValue({ ok: true, emails: [] })
})

function conCompras(compras: ReturnType<typeof compra>[]) {
  tablas.course_purchases = { data: compras, error: null }
  tablas.profiles = {
    data: compras.map((c) => ({ id: c.user_id, email: `${c.id}@example.com`, full_name: `Nombre ${c.id}` })),
    error: null,
  }
  for (const c of compras) if (!usuarios.has(c.user_id)) usuarios.set(c.user_id, { last_sign_in_at: null })
}

describe('getEmailPanel · compras', () => {
  it('compra cuyo correo se entregó: entregado y nada que hacer', async () => {
    conCompras([compra('ana')])
    listSentEmails.mockResolvedValue({ ok: true, emails: [enviado('ana@example.com', PURCHASE_CONFIRMATION_SUBJECT, haceDias(2))] })
    const p = await getEmailPanel()
    expect(p.compras[0]).toMatchObject({ estado: 'entregado', necesitaAccion: false, reenviable: true, detalle: 'CURSO BACHATANGO' })
    expect(p.pendientes).toBe(0)
  })

  it('compra sin correo en Resend: no enviado, hay que actuar y se dice si ya entró', async () => {
    conCompras([compra('ana')])
    const p = await getEmailPanel()
    expect(p.compras[0]).toMatchObject({ estado: 'no-enviado', necesitaAccion: true, nota: 'Todavía no ha entrado en su cuenta' })
    expect(p.pendientes).toBe(1)
  })

  it('si ya ha entrado en su cuenta no cuenta como pendiente', async () => {
    conCompras([compra('ana')])
    usuarios.set('u-ana', { last_sign_in_at: haceDias(1) })
    const p = await getEmailPanel()
    expect(p.compras[0]).toMatchObject({ estado: 'no-enviado', necesitaAccion: false, nota: 'Ya ha entrado en su cuenta' })
    expect(p.pendientes).toBe(0)
  })

  it('una compra de hace dos minutos sin correo todavía va en camino', async () => {
    conCompras([compra('ana', { created_at: haceMin(2) })])
    expect((await getEmailPanel()).compras[0].estado).toBe('en-camino')
  })

  it('un correo de compra ANTERIOR a esta compra no cuenta', async () => {
    conCompras([compra('ana')])
    listSentEmails.mockResolvedValue({ ok: true, emails: [enviado('ana@example.com', PURCHASE_CONFIRMATION_SUBJECT, haceDias(10))] })
    expect((await getEmailPanel()).compras[0].estado).toBe('no-enviado')
  })

  it('otro asunto a la misma persona no cuenta', async () => {
    conCompras([compra('ana')])
    listSentEmails.mockResolvedValue({ ok: true, emails: [enviado('ana@example.com', 'Cambia tu contraseña', haceDias(1))] })
    expect((await getEmailPanel()).compras[0].estado).toBe('no-enviado')
  })

  it('compara el email sin mayúsculas', async () => {
    conCompras([compra('ana')])
    tablas.profiles = { data: [{ id: 'u-ana', email: 'Ana@Example.com', full_name: null }], error: null }
    listSentEmails.mockResolvedValue({ ok: true, emails: [enviado('ana@example.com', PURCHASE_CONFIRMATION_SUBJECT, haceDias(2))] })
    expect((await getEmailPanel()).compras[0].estado).toBe('entregado')
  })

  it('rebotado cuenta como pendiente', async () => {
    conCompras([compra('ana')])
    listSentEmails.mockResolvedValue({ ok: true, emails: [enviado('ana@example.com', PURCHASE_CONFIRMATION_SUBJECT, haceDias(2), 'bounced')] })
    const p = await getEmailPanel()
    expect(p.compras[0]).toMatchObject({ estado: 'rebotado', necesitaAccion: true })
  })

  it('compra con la sesión iniciada: la web no manda el correo, no es un fallo pero se puede mandar', async () => {
    conCompras([compra('ana', { source: 'web' })])
    const p = await getEmailPanel()
    expect(p.compras[0]).toMatchObject({ estado: 'no-aplica', necesitaAccion: false, reenviable: true })
    expect(p.compras[0].nota).toMatch(/sesión iniciada/)
  })

  it('reembolsada: ni cuenta ni se puede mandar un «ya tienes acceso»', async () => {
    conCompras([compra('ana', { refunded_at: haceDias(1) })])
    const p = await getEmailPanel()
    expect(p.compras[0]).toMatchObject({ reenviable: false, necesitaAccion: false, nota: 'Reembolsada' })
  })

  it('si Resend no responde, el estado es desconocido y no se avisa de nada', async () => {
    conCompras([compra('ana')])
    listSentEmails.mockResolvedValue({ ok: false, reason: 'error' })
    const p = await getEmailPanel()
    expect(p.resend).toEqual({ ok: false, reason: 'error' })
    expect(p.compras[0]).toMatchObject({ estado: 'desconocido', necesitaAccion: false, reenviable: true })
  })

  it('marca el error de BD en vez de enseñar un panel vacío como si todo fuera bien', async () => {
    tablas.course_purchases = { data: null, error: { message: 'boom' } }
    expect((await getEmailPanel()).errorBd).toBe(true)
  })
})

describe('getEmailPanel · clases gratis', () => {
  const alta = (email: string, extra: Record<string, unknown> = {}) =>
    ({ email, consent_at: haceDias(1), subscribed_at: haceDias(1), unsubscribed_at: null, ...extra })

  it('alta sin su correo: no enviado y pendiente', async () => {
    tablas.newsletter_subscribers = { data: [alta('eva@example.com')], error: null }
    const p = await getEmailPanel()
    expect(p.clasesGratis[0]).toMatchObject({ ref: 'eva@example.com', estado: 'no-enviado', necesitaAccion: true, reenviable: true })
    expect(p.pendientes).toBe(1)
  })

  it('alta con su correo entregado', async () => {
    tablas.newsletter_subscribers = { data: [alta('eva@example.com')], error: null }
    listSentEmails.mockResolvedValue({ ok: true, emails: [enviado('eva@example.com', FREE_CLASSES_SUBJECT, haceDias(1))] })
    expect((await getEmailPanel()).clasesGratis[0].estado).toBe('entregado')
  })

  it('a quien se dio de baja no se le manda nada ni cuenta como pendiente', async () => {
    tablas.newsletter_subscribers = { data: [alta('eva@example.com', { unsubscribed_at: haceMin(30) })], error: null }
    const p = await getEmailPanel()
    expect(p.clasesGratis[0]).toMatchObject({ reenviable: false, necesitaAccion: false, nota: 'Se dio de baja' })
  })
})

describe('getEmailAviso', () => {
  it('cuenta los pendientes', async () => {
    conCompras([compra('ana')])
    expect(await getEmailAviso()).toEqual({ pendientes: 1, sinEnvio: false })
  })

  it('una clave de Resend inválida es «no sale ningún correo»', async () => {
    listSentEmails.mockResolvedValue({ ok: false, reason: 'clave-invalida' })
    expect(await getEmailAviso()).toEqual({ pendientes: 0, sinEnvio: true })
  })

  it('nunca lanza', async () => {
    requireAdmin.mockRejectedValue(new Error('forbidden'))
    expect(await getEmailAviso()).toEqual({ pendientes: 0, sinEnvio: false })
  })
})
