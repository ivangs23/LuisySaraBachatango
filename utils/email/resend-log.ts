import 'server-only'

/** Un correo tal como lo registra Resend. */
export type SentEmail = {
  id: string
  /** Destinatarios, en minúsculas. */
  to: string[]
  subject: string
  /** Milisegundos desde epoch. */
  createdAt: number
  /** delivered, bounced, complained, sent, delivery_delayed… */
  lastEvent: string
}

/**
 * Por qué no se pudo leer el registro.
 *
 * `clave-invalida` es el caso grave y el que hay que poder ver: Resend
 * rechaza la clave, así que tampoco sale NINGÚN correo de la web. Así pasó
 * del 23 al 27 de octubre de 2026, con dos compradores y cuatro altas sin
 * correo y sin que nadie se enterara.
 */
export type ResendLogError = 'sin-clave' | 'clave-invalida' | 'sin-permiso' | 'error'

export type SentEmailsResult =
  | { ok: true; emails: SentEmail[] }
  | { ok: false; reason: ResendLogError }

type RawEmail = { id: string; to: string[] | string; subject: string; created_at: string; last_event: string }

const PAGINA = 100
/** Cota de seguridad: a este volumen, 1000 correos son meses. */
const MAX_PAGINAS = 10

/**
 * Resend da las fechas como `2026-10-23 09:55:33.922000+00`: espacio en vez de
 * `T`, microsegundos y zona sin minutos. `Date.parse` no promete entender eso,
 * así que se pasa a ISO antes.
 */
export function parseResendDate(s: string): number {
  const iso = s
    .trim()
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1')
    .replace(/([+-]\d{2})$/, '$1:00')
  return Date.parse(iso)
}

function motivo(status: number, body: { name?: string; message?: string }): ResendLogError {
  if (body.name === 'restricted_api_key') return 'sin-permiso'
  if (body.name === 'invalid_api_key' || body.name === 'missing_api_key' || /api key is invalid/i.test(body.message ?? '')) {
    return 'clave-invalida'
  }
  if (status === 401 || status === 403) return 'sin-permiso'
  return 'error'
}

/**
 * Lee del registro de Resend los correos enviados desde `sinceMs`, del más
 * reciente al más antiguo.
 *
 * Es la fuente de verdad de «¿le salió el correo?»: incluye lo que Resend
 * aceptó y lo que pasó después (entregado, rebotado, spam). Lo que no aparece
 * aquí no salió. Necesita una clave con permiso «Full access»: una de «Sending
 * access» solo puede enviar y aquí devuelve `sin-permiso`.
 *
 * Nunca lanza.
 */
export async function listSentEmails(sinceMs: number): Promise<SentEmailsResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'sin-clave' }

  const emails: SentEmail[] = []
  let after: string | undefined
  try {
    for (let i = 0; i < MAX_PAGINAS; i++) {
      const url = `https://api.resend.com/emails?limit=${PAGINA}${after ? `&after=${after}` : ''}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      })
      const body = await res.json().catch(() => ({})) as { data?: RawEmail[]; has_more?: boolean; name?: string; message?: string }
      if (!res.ok) return { ok: false, reason: motivo(res.status, body) }

      const data = body.data ?? []
      for (const e of data) {
        emails.push({
          id: e.id,
          to: (Array.isArray(e.to) ? e.to : [e.to]).map((t) => t.toLowerCase()),
          subject: e.subject,
          createdAt: parseResendDate(e.created_at),
          lastEvent: e.last_event,
        })
      }
      // `after` pide la página siguiente, que es la de correos más antiguos.
      const ultimo = emails[emails.length - 1]
      if (!body.has_more || data.length === 0 || ultimo.createdAt < sinceMs) break
      after = data[data.length - 1].id
    }
  } catch {
    return { ok: false, reason: 'error' }
  }
  return { ok: true, emails: emails.filter((e) => e.createdAt >= sinceMs) }
}
