import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// Cada consulta acaba en un mock distinto para poder ver sus filtros.
const subsIs = vi.fn()
const subsEq = vi.fn(() => ({ is: subsIs }))
const purchasesSelect = vi.fn()
const profilesIn = vi.fn()
const sendsEq = vi.fn()
const sendsInsert = vi.fn()
const delEqStep = vi.fn()
const delEqSeq = vi.fn(() => ({ eq: delEqStep }))
const delEqEmail = vi.fn(() => ({ eq: delEqSeq }))

const fromMock = vi.fn((table: string) => {
  switch (table) {
    case 'newsletter_subscribers': return { select: () => ({ eq: subsEq }) }
    case 'course_purchases': return { select: purchasesSelect }
    case 'profiles': return { select: () => ({ in: profilesIn }) }
    case 'email_sends': return {
      select: () => ({ eq: sendsEq }),
      insert: sendsInsert,
      delete: () => ({ eq: delEqEmail }),
    }
    default: throw new Error(`tabla inesperada ${table}`)
  }
})
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({ from: fromMock }) }))

import {
  loadNurtureSubscribers, loadBuyerEmails, loadSentSteps, claimSend, releaseSend,
} from '@/utils/email/sequences/store'

beforeEach(() => { vi.clearAllMocks() })

describe('loadNurtureSubscribers', () => {
  it('solo quien pidió las clases y no se ha dado de baja', async () => {
    subsIs.mockResolvedValue({ data: [], error: null })
    await loadNurtureSubscribers()
    expect(subsEq).toHaveBeenCalledWith('consent_source', 'clase_gratis')
    expect(subsIs).toHaveBeenCalledWith('unsubscribed_at', null)
  })

  it('normaliza el email y descarta filas sin fecha de alta', async () => {
    subsIs.mockResolvedValue({
      data: [
        { email: 'Ana@Example.com', consent_at: '2026-10-01T10:00:00Z' },
        { email: 'sin@fecha.com', consent_at: null },
      ],
      error: null,
    })
    expect(await loadNurtureSubscribers()).toEqual([
      { email: 'ana@example.com', consentAt: new Date('2026-10-01T10:00:00Z') },
    ])
  })

  it('lanza si la BD falla: mejor no enviar que enviar a ciegas', async () => {
    subsIs.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(loadNurtureSubscribers()).rejects.toThrow()
  })
})

describe('loadBuyerEmails', () => {
  it('emails (en minúsculas) de quien tiene una compra', async () => {
    purchasesSelect.mockResolvedValue({ data: [{ user_id: 'u1' }, { user_id: 'u1' }, { user_id: 'u2' }], error: null })
    profilesIn.mockResolvedValue({ data: [{ email: 'Ana@Example.com' }, { email: null }], error: null })
    expect(await loadBuyerEmails()).toEqual(new Set(['ana@example.com']))
    expect(profilesIn).toHaveBeenCalledWith('id', ['u1', 'u2'])
  })

  it('sin compras no consulta perfiles', async () => {
    purchasesSelect.mockResolvedValue({ data: [], error: null })
    expect(await loadBuyerEmails()).toEqual(new Set())
    expect(profilesIn).not.toHaveBeenCalled()
  })
})

describe('loadSentSteps', () => {
  it('agrupa los pasos enviados por email', async () => {
    sendsEq.mockResolvedValue({
      data: [{ email: 'ana@example.com', step: 2 }, { email: 'ana@example.com', step: 3 }, { email: 'bea@example.com', step: 2 }],
      error: null,
    })
    const m = await loadSentSteps('nutricion')
    expect(sendsEq).toHaveBeenCalledWith('sequence', 'nutricion')
    expect(m.get('ana@example.com')).toEqual(new Set([2, 3]))
    expect(m.get('bea@example.com')).toEqual(new Set([2]))
  })

  it('lanza si la tabla no existe todavía', async () => {
    sendsEq.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation "email_sends" does not exist' } })
    await expect(loadSentSteps('nutricion')).rejects.toThrow()
  })
})

describe('claimSend / releaseSend', () => {
  it('apunta el envío', async () => {
    sendsInsert.mockResolvedValue({ error: null })
    expect(await claimSend('ana@example.com', 'nutricion', 2)).toBe('claimed')
    expect(sendsInsert).toHaveBeenCalledWith({ email: 'ana@example.com', sequence: 'nutricion', step: 2 })
  })

  it('si el unique salta, otra ejecución se adelantó', async () => {
    sendsInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } })
    expect(await claimSend('ana@example.com', 'nutricion', 2)).toBe('taken')
  })

  it('cualquier otro error es un error', async () => {
    sendsInsert.mockResolvedValue({ error: { code: 'XX000', message: 'boom' } })
    expect(await claimSend('ana@example.com', 'nutricion', 2)).toBe('error')
  })

  it('borra exactamente la fila de ese paso', async () => {
    delEqStep.mockResolvedValue({ error: null })
    await releaseSend('ana@example.com', 'nutricion', 2)
    expect(delEqEmail).toHaveBeenCalledWith('email', 'ana@example.com')
    expect(delEqSeq).toHaveBeenCalledWith('sequence', 'nutricion')
    expect(delEqStep).toHaveBeenCalledWith('step', 2)
  })
})
