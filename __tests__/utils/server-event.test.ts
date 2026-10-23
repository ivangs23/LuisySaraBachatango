import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const insertMock = vi.fn()
const fromMock = vi.fn(() => ({ insert: insertMock }))
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({ from: fromMock }) }))

let demo = false
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => demo }))

const hashMock = vi.fn()
vi.mock('@/utils/analytics/visitor-hash', () => ({ dailyVisitorHash: (...a: unknown[]) => hashMock(...a) }))

import { recordServerEvent } from '@/utils/analytics/server-event'

// Eventos que ocurren en una Server Action (el lead del formulario), con la
// misma tubería que las vistas: hash diario, sin cookies, sin datos personales.
describe('recordServerEvent', () => {
  beforeEach(() => {
    demo = false
    insertMock.mockReset().mockResolvedValue({ error: null })
    fromMock.mockClear()
    hashMock.mockReset().mockReturnValue('hash-del-dia')
  })

  it('guarda la ruta con el hash diario del visitante', async () => {
    await recordServerEvent('/curso-bachatango/lead', '1.2.3.4', 'UA')
    expect(fromMock).toHaveBeenCalledWith('landing_events')
    expect(insertMock).toHaveBeenCalledWith({ path: '/curso-bachatango/lead', visitor_hash: 'hash-del-dia' })
  })

  it('en modo demo no escribe: local y preview no deben inflar las métricas', async () => {
    demo = true
    await recordServerEvent('/curso-bachatango/lead', '1.2.3.4', 'UA')
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('sin LANDING_ANALYTICS_SECRET (sin hash) no escribe', async () => {
    hashMock.mockReturnValue(null)
    await recordServerEvent('/curso-bachatango/lead', '1.2.3.4', 'UA')
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('nunca lanza: la analítica no puede tumbar la acción', async () => {
    insertMock.mockRejectedValue(new Error('boom'))
    await expect(recordServerEvent('/curso-bachatango/lead', '1.2.3.4', 'UA')).resolves.toBeUndefined()
  })
})
