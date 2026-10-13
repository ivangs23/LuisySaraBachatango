import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import {
  buildPurchaseEvent,
  hashPii,
  sendPurchaseToMeta,
  splitName,
} from '@/utils/analytics/meta-capi'
import type { MetaAttribution } from '@/utils/analytics/meta-attribution'

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

const CONSENTIDO: MetaAttribution = {
  fbp: 'fb.1.1.p', fbc: 'fb.1.2.c', ip: '1.2.3.4', ua: 'UA', marketingConsent: true,
}
const RECHAZADO: MetaAttribution = { ...CONSENTIDO, marketingConsent: false }

const INPUT = {
  eventId: 'cs_test_123',
  eventTime: 1_760_000_000,
  eventSourceUrl: 'https://luisysarabachatango.com/gracias',
  email: '  Ana@Ejemplo.COM ',
  fullName: 'Ana María Pérez Gil',
  value: 119,
  currency: 'EUR',
  contentName: 'Curso Bachatango',
  attribution: CONSENTIDO,
}

describe('hashPii', () => {
  it('normaliza a minúsculas y sin espacios antes de hashear', () => {
    expect(hashPii('  Ana@Ejemplo.COM ')).toBe(sha('ana@ejemplo.com'))
  })

  it('nunca hashea la cadena vacía', () => {
    // El SHA-256 de "" es una constante conocida: mandarlo casaría entre sí a
    // todos los compradores sin email.
    for (const raw of ['', '   ', null, undefined]) {
      expect(hashPii(raw)).toBeNull()
    }
  })
})

describe('splitName', () => {
  it('separa nombre y apellidos', () => {
    expect(splitName('Ana María Pérez Gil')).toEqual({ first: 'Ana', last: 'María Pérez Gil' })
  })

  it('con una sola palabra no inventa apellido', () => {
    expect(splitName('Ana')).toEqual({ first: 'Ana', last: null })
  })

  it('tolera espacios de más y vacíos', () => {
    expect(splitName('  Ana   Gil  ')).toEqual({ first: 'Ana', last: 'Gil' })
    expect(splitName('   ')).toEqual({ first: null, last: null })
    expect(splitName(null)).toEqual({ first: null, last: null })
  })
})

describe('buildPurchaseEvent', () => {
  it('manda el id de la sesión como event_id, que es lo que deduplica', () => {
    const e = buildPurchaseEvent(INPUT).data as Record<string, unknown>[]
    expect(e[0].event_id).toBe('cs_test_123')
    expect(e[0].event_name).toBe('Purchase')
    expect(e[0].action_source).toBe('website')
  })

  it('hashea email, nombre y apellido; deja fbp/fbc/IP/UA en claro', () => {
    const e = buildPurchaseEvent(INPUT).data as Record<string, unknown>[]
    const ud = e[0].user_data as Record<string, unknown>
    expect(ud.em).toEqual([sha('ana@ejemplo.com')])
    expect(ud.fn).toEqual([sha('ana')])
    expect(ud.ln).toEqual([sha('maría pérez gil')])
    // Estos NO se hashean: Meta los quiere tal cual.
    expect(ud.fbp).toBe('fb.1.1.p')
    expect(ud.fbc).toBe('fb.1.2.c')
    expect(ud.client_ip_address).toBe('1.2.3.4')
    expect(ud.client_user_agent).toBe('UA')
  })

  it('ningún dato personal viaja sin hashear', () => {
    const json = JSON.stringify(buildPurchaseEvent(INPUT))
    expect(json).not.toContain('ana@ejemplo.com')
    expect(json).not.toContain('Ana')
    expect(json).not.toContain('Pérez')
  })

  it('omite las claves que no tiene en vez de mandarlas vacías', () => {
    const e = buildPurchaseEvent({
      ...INPUT, email: null, fullName: null,
      attribution: { fbp: null, fbc: null, ip: null, ua: null, marketingConsent: true },
    }).data as Record<string, unknown>[]
    expect(e[0].user_data).toEqual({})
  })

  it('lleva el importe y el producto en custom_data', () => {
    const e = buildPurchaseEvent(INPUT).data as Record<string, unknown>[]
    expect(e[0].custom_data).toEqual({ value: 119, currency: 'EUR', content_name: 'Curso Bachatango' })
  })

  it('añade test_event_code solo si se le da', () => {
    expect(buildPurchaseEvent(INPUT).test_event_code).toBeUndefined()
    expect(buildPurchaseEvent({ ...INPUT, testEventCode: 'TEST123' }).test_event_code).toBe('TEST123')
  })
})

describe('sendPurchaseToMeta — cuándo NO se manda', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true, text: async () => '' })
    vi.stubEnv('META_CAPI_TOKEN', 'token-de-prueba')
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '941883441913782')
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('sin consentimiento de marketing no sale nada hacia Meta', async () => {
    const r = await sendPurchaseToMeta({ ...INPUT, attribution: RECHAZADO })
    expect(r).toEqual({ sent: false, reason: 'no-consent' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('en modo demo tampoco: preview y local no deben inflar el píxel real', async () => {
    const r = await sendPurchaseToMeta(INPUT, { isDemo: true })
    expect(r).toEqual({ sent: false, reason: 'demo' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sin token configurado no intenta la llamada', async () => {
    vi.stubEnv('META_CAPI_TOKEN', '')
    const r = await sendPurchaseToMeta(INPUT)
    expect(r).toEqual({ sent: false, reason: 'not-configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sin píxel configurado tampoco (sería un envío que no deduplica)', async () => {
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '')
    expect(await sendPurchaseToMeta(INPUT)).toEqual({ sent: false, reason: 'not-configured' })
  })
})

describe('sendPurchaseToMeta — envío', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    vi.stubEnv('META_CAPI_TOKEN', 'token-de-prueba')
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', '941883441913782')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('postea al píxel configurado, que es el mismo del navegador', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '' })
    expect(await sendPurchaseToMeta(INPUT)).toEqual({ sent: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/941883441913782/events')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).data[0].event_id).toBe('cs_test_123')
  })

  it('coge META_TEST_EVENT_CODE del entorno si está', async () => {
    vi.stubEnv('META_TEST_EVENT_CODE', 'TEST999')
    fetchMock.mockResolvedValue({ ok: true, text: async () => '' })
    await sendPurchaseToMeta(INPUT)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).test_event_code).toBe('TEST999')
  })

  it('un rechazo de Meta se reporta, no se lanza', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'Invalid token' })
    expect(await sendPurchaseToMeta(INPUT)).toEqual({ sent: false, reason: 'http-error' })
  })

  it('una caída de red tampoco lanza: la venta ya está hecha', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'))
    expect(await sendPurchaseToMeta(INPUT)).toEqual({ sent: false, reason: 'network-error' })
  })

  it('el token no aparece nunca en el cuerpo del evento', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '' })
    await sendPurchaseToMeta(INPUT)
    expect(fetchMock.mock.calls[0][1].body).not.toContain('token-de-prueba')
  })
})
