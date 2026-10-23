import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

const store = {
  loadNurtureSubscribers: vi.fn(),
  loadBuyerEmails: vi.fn(),
  loadSentSteps: vi.fn(),
  claimSend: vi.fn(),
  releaseSend: vi.fn(),
}
vi.mock('@/utils/email/sequences/store', () => ({
  loadNurtureSubscribers: () => store.loadNurtureSubscribers(),
  loadBuyerEmails: () => store.loadBuyerEmails(),
  loadSentSteps: (s: string) => store.loadSentSteps(s),
  claimSend: (...a: unknown[]) => store.claimSend(...a),
  releaseSend: (...a: unknown[]) => store.releaseSend(...a),
}))

const sendStepContent = vi.fn()
vi.mock('@/utils/email/sequences/send', () => ({
  sendStepContent: (...a: unknown[]) => sendStepContent(...a),
}))

vi.mock('@/utils/courses/curriculum', () => ({
  getCurriculum: async () => ({ modules: [], moduleCount: 14, lessonCount: 28, totalSeconds: 7920 }),
  formatDuration: () => '2 h 12 min',
}))
vi.mock('@/utils/courses/landing-course', () => ({
  getLandingCourse: async () => ({ id: 'c1', title: 'CURSO BACHATANGO', image_url: null, price_eur: 119 }),
}))

const alertaCritica = vi.fn()
const avisoAuth = vi.fn()
vi.mock('@/utils/alerta', () => ({
  alertaCritica: (...a: unknown[]) => alertaCritica(...a),
  avisoAuth: (...a: unknown[]) => avisoAuth(...a),
}))

import { GET } from '@/app/api/cron/lifecycle-emails/route'

const AHORA = new Date('2026-10-23T08:00:00Z')
const haceDias = (d: number) => new Date(AHORA.getTime() - d * 86_400_000)

function peticion(auth = 'Bearer s3cr3t') {
  return new Request('https://x/api/cron/lifecycle-emails', { headers: { authorization: auth } })
}

async function ejecutar(auth?: string) {
  const res = await GET(peticion(auth))
  return { status: res.status, body: res.status === 200 ? await res.json() : null }
}

describe('/api/cron/lifecycle-emails', () => {
  let orden: string[]

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(AHORA)
    vi.stubEnv('CRON_SECRET', 's3cr3t')
    vi.stubEnv('LIFECYCLE_EMAILS_ENABLED', '1')
    orden = []
    store.loadNurtureSubscribers.mockReset().mockResolvedValue([])
    store.loadBuyerEmails.mockReset().mockResolvedValue(new Set())
    store.loadSentSteps.mockReset().mockResolvedValue(new Map())
    store.claimSend.mockReset().mockImplementation(async (_e: string, _s: string, step: number) => {
      orden.push(`claim:${step}`)
      return 'claimed'
    })
    store.releaseSend.mockReset().mockResolvedValue(undefined)
    sendStepContent.mockReset().mockImplementation(async () => { orden.push('send'); return true })
    alertaCritica.mockReset()
    avisoAuth.mockReset()
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

  it('sin CRON_SECRET configurado responde 401', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await ejecutar()).status).toBe(401)
  })

  it('con otro secreto responde 401 y avisa', async () => {
    expect((await ejecutar('Bearer otro')).status).toBe(401)
    expect(avisoAuth).toHaveBeenCalled()
    expect(store.loadNurtureSubscribers).not.toHaveBeenCalled()
  })

  // Hasta que Luis y Sara revisen los textos, el cron existe pero no envía.
  it('sin LIFECYCLE_EMAILS_ENABLED=1 no toca nada', async () => {
    vi.stubEnv('LIFECYCLE_EMAILS_ENABLED', '')
    const r = await ejecutar()
    expect(r.body).toEqual({ ok: true, enabled: false })
    expect(store.loadNurtureSubscribers).not.toHaveBeenCalled()
    expect(sendStepContent).not.toHaveBeenCalled()
  })

  it('manda el paso que toca, apuntándolo ANTES de enviar', async () => {
    store.loadNurtureSubscribers.mockResolvedValue([{ email: 'ana@example.com', consentAt: haceDias(2) }])
    const r = await ejecutar()
    expect(store.claimSend).toHaveBeenCalledWith('ana@example.com', 'nutricion', 2)
    expect(orden).toEqual(['claim:2', 'send'])
    expect(sendStepContent.mock.calls[0][1].subject).toBe('El detalle que cambia tu abrazo')
    expect(r.body).toMatchObject({ ok: true, sent: 1, failed: 0 })
  })

  it('el paso 1 nunca lo manda el cron: lo envía el formulario', async () => {
    store.loadNurtureSubscribers.mockResolvedValue([{ email: 'ana@example.com', consentAt: haceDias(0) }])
    await ejecutar()
    expect(sendStepContent).not.toHaveBeenCalled()
  })

  it('no repite un paso ya enviado', async () => {
    store.loadNurtureSubscribers.mockResolvedValue([{ email: 'ana@example.com', consentAt: haceDias(3) }])
    store.loadSentSteps.mockResolvedValue(new Map([['ana@example.com', new Set([2])]]))
    await ejecutar()
    expect(sendStepContent).not.toHaveBeenCalled()
  })

  it('quien ya compró sale de la secuencia', async () => {
    store.loadNurtureSubscribers.mockResolvedValue([{ email: 'ana@example.com', consentAt: haceDias(14) }])
    store.loadBuyerEmails.mockResolvedValue(new Set(['ana@example.com']))
    await ejecutar()
    expect(sendStepContent).not.toHaveBeenCalled()
  })

  it('sin testimonio real se salta el paso 4 y sigue con el 5', async () => {
    store.loadNurtureSubscribers.mockResolvedValue([{ email: 'ana@example.com', consentAt: haceDias(10) }])
    store.loadSentSteps.mockResolvedValue(new Map([['ana@example.com', new Set([2, 3])]]))
    await ejecutar()
    expect(store.claimSend).toHaveBeenCalledTimes(1)
    expect(store.claimSend).toHaveBeenCalledWith('ana@example.com', 'nutricion', 5)
  })

  it('un solo correo por persona y ejecución, aunque vaya atrasada', async () => {
    store.loadNurtureSubscribers.mockResolvedValue([{ email: 'ana@example.com', consentAt: haceDias(20) }])
    await ejecutar()
    expect(sendStepContent).toHaveBeenCalledTimes(1)
    expect(store.claimSend).toHaveBeenCalledWith('ana@example.com', 'nutricion', 2)
  })

  it('si otra ejecución ya lo apuntó, no lo manda', async () => {
    store.loadNurtureSubscribers.mockResolvedValue([{ email: 'ana@example.com', consentAt: haceDias(2) }])
    store.claimSend.mockResolvedValue('taken')
    await ejecutar()
    expect(sendStepContent).not.toHaveBeenCalled()
  })

  it('si el envío falla, borra la fila para reintentarlo y avisa una vez', async () => {
    store.loadNurtureSubscribers.mockResolvedValue([
      { email: 'ana@example.com', consentAt: haceDias(2) },
      { email: 'bea@example.com', consentAt: haceDias(2) },
    ])
    sendStepContent.mockResolvedValue(false)
    const r = await ejecutar()
    expect(store.releaseSend).toHaveBeenCalledWith('ana@example.com', 'nutricion', 2)
    expect(store.releaseSend).toHaveBeenCalledWith('bea@example.com', 'nutricion', 2)
    expect(alertaCritica).toHaveBeenCalledTimes(1)
    expect(r.body).toMatchObject({ sent: 0, failed: 2 })
  })

  it('no pasa de 200 envíos por ejecución', async () => {
    store.loadNurtureSubscribers.mockResolvedValue(
      Array.from({ length: 250 }, (_, i) => ({ email: `p${i}@example.com`, consentAt: haceDias(2) })),
    )
    const r = await ejecutar()
    expect(sendStepContent).toHaveBeenCalledTimes(200)
    expect(r.body).toMatchObject({ sent: 200 })
  })

  // Sin la tabla no se pueden evitar duplicados: mejor no enviar nada.
  it('si no puede leer email_sends, 500 y ningún envío', async () => {
    store.loadNurtureSubscribers.mockResolvedValue([{ email: 'ana@example.com', consentAt: haceDias(2) }])
    store.loadSentSteps.mockRejectedValue(new Error('relation "email_sends" does not exist'))
    const r = await ejecutar()
    expect(r.status).toBe(500)
    expect(sendStepContent).not.toHaveBeenCalled()
    expect(alertaCritica).toHaveBeenCalled()
  })
})
