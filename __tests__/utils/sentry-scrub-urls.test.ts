import { describe, it, expect } from 'vitest'
import { scrubSensitive } from '@/utils/sentry/scrub'

const TOKEN = 'a1b2c3d4e5f6a1b2c3d4e5f6'
const URL_BAJA = `https://luisysarabachatango.com/unsubscribe?email=alumna%40gmail.com&token=${TOKEN}`

/**
 * `scrubSensitive` denegaba por NOMBRE de campo y recorría solo `request.data` y
 * `extra`. La URL de baja del boletín lleva el correo y un token VÁLIDO en la
 * query (`utils/email/newsletter-welcome.ts:28`), así que viajaba entera a
 * Sentry en cuatro sitios distintos — y no solo en errores: también en las
 * transacciones muestreadas, que es tráfico normal.
 *
 * Quien tuviera acceso a Sentry podía dar de baja a cualquiera.
 */
describe('scrubSensitive — la query nunca sale del servidor', () => {
  function evento(): Record<string, unknown> {
    return {
      request: { url: URL_BAJA, query_string: `email=alumna%40gmail.com&token=${TOKEN}` },
      contexts: { trace: { data: { 'url.full': URL_BAJA, 'http.request.method': 'GET' } } },
      spans: [{ data: { 'url.full': URL_BAJA } }, { data: { 'http.url': URL_BAJA } }],
    }
  }

  it('recorta request.url y conserva la ruta', () => {
    const e = evento()
    scrubSensitive(e as never)
    const req = e.request as { url: string }
    expect(req.url).toBe('https://luisysarabachatango.com/unsubscribe')
  })

  it('elimina request.query_string', () => {
    const e = evento()
    scrubSensitive(e as never)
    expect((e.request as { query_string?: unknown }).query_string).toBeUndefined()
  })

  it('recorta la URL del contexto de traza', () => {
    const e = evento()
    scrubSensitive(e as never)
    const trace = (e.contexts as { trace: { data: Record<string, string> } }).trace
    expect(trace.data['url.full']).toBe('https://luisysarabachatango.com/unsubscribe')
    expect(trace.data['http.request.method']).toBe('GET')
  })

  it('recorta las URLs de los spans', () => {
    const e = evento()
    scrubSensitive(e as never)
    const spans = e.spans as Array<{ data: Record<string, string> }>
    expect(spans[0].data['url.full']).toBe('https://luisysarabachatango.com/unsubscribe')
    expect(spans[1].data['http.url']).toBe('https://luisysarabachatango.com/unsubscribe')
  })

  it('ni el token ni el correo quedan en ninguna parte del evento', () => {
    const e = evento()
    scrubSensitive(e as never)
    const serializado = JSON.stringify(e)
    expect(serializado).not.toContain(TOKEN)
    expect(serializado).not.toContain('alumna')
  })

  it('una URL sin query se queda igual', () => {
    const e = { request: { url: 'https://luisysarabachatango.com/courses' } }
    scrubSensitive(e as never)
    expect(e.request.url).toBe('https://luisysarabachatango.com/courses')
  })

  it('no revienta con un evento vacío ni con URLs malformadas', () => {
    expect(() => scrubSensitive({} as never)).not.toThrow()
    const raro = { request: { url: 'no-es-una-url?token=x' } }
    expect(() => scrubSensitive(raro as never)).not.toThrow()
    expect(raro.request.url).not.toContain('token=x')
  })

  it('sigue filtrando por nombre de campo como antes', () => {
    const e = { request: { data: { password: 'hunter2', email: 'a@b.es' } }, extra: { phone: '600' } }
    scrubSensitive(e as never)
    expect(e.request.data.password).toBe('[Filtered]')
    expect(e.request.data.email).toBe('[Filtered]')
    expect(e.extra.phone).toBe('[Filtered]')
  })
})
