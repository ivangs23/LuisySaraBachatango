import { createHash } from 'node:crypto'
import type { MetaAttribution } from '@/utils/analytics/meta-attribution'

/**
 * API de conversiones de Meta: la compra, contada desde el servidor.
 *
 * Por qué además del píxel: el navegador pierde conversiones por bloqueadores,
 * ITP de Safari y pestañas cerradas antes de que el script arranque. El
 * servidor no. Las dos las manda con el MISMO `event_id` (el id de la sesión de
 * Stripe), que es lo que usa Meta para quedarse con una sola y no contar la
 * venta dos veces.
 *
 * Dos reglas que no se negocian:
 *
 * 1. NUNCA romper el webhook. Un fallo de Meta no puede impedir que el alumno
 *    reciba su acceso, así que todo va en try/catch y lo peor que pasa es una
 *    línea de log. Esta función no lanza.
 * 2. NUNCA sin consentimiento. Mandar email hasheado e IP a Meta es
 *    tratamiento con fines publicitarios: si el visitante rechazó marketing, no
 *    sale nada. La decisión viaja en `session.metadata` porque el webhook lo
 *    llama Stripe y ahí no hay cookie que consultar.
 */

const GRAPH_VERSION = 'v21.0'
const TIMEOUT_MS = 5_000

/**
 * Normaliza y hashea como exige Meta: minúsculas, sin espacios alrededor y
 * SHA-256 en hexadecimal. Devuelve null si no hay nada que hashear, para no
 * mandar el hash de la cadena vacía (que es un valor constante y conocido, y
 * casaría a todo el mundo entre sí).
 */
export function hashPii(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normal = value.trim().toLowerCase()
  if (!normal) return null
  return createHash('sha256').update(normal, 'utf8').digest('hex')
}

/**
 * Parte "Luis Alberto Montero del Alba" en nombre y apellidos. Meta solo
 * quiere `fn` y `ln` por separado; con una sola palabra no hay apellido que dar.
 */
export function splitName(fullName: string | null | undefined): { first: string | null; last: string | null } {
  if (typeof fullName !== 'string') return { first: null, last: null }
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: null, last: null }
  if (parts.length === 1) return { first: parts[0], last: null }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export interface PurchaseEventInput {
  /** Id de la sesión de Stripe. Es el `event_id` que deduplica con el píxel. */
  eventId: string
  /** Segundos Unix. */
  eventTime: number
  eventSourceUrl: string
  email: string | null
  fullName: string | null
  /** Importe en euros, ya dividido entre 100. */
  value: number
  currency: string
  contentName: string
  attribution: MetaAttribution
  testEventCode?: string | null
}

/** Payload tal y como lo espera `/events`. Separado del envío para poder testearlo. */
export function buildPurchaseEvent(input: PurchaseEventInput): Record<string, unknown> {
  const { first, last } = splitName(input.fullName)

  const userData: Record<string, unknown> = {}
  const em = hashPii(input.email)
  const fn = hashPii(first)
  const ln = hashPii(last)
  if (em) userData.em = [em]
  if (fn) userData.fn = [fn]
  if (ln) userData.ln = [ln]
  if (input.attribution.fbp) userData.fbp = input.attribution.fbp
  if (input.attribution.fbc) userData.fbc = input.attribution.fbc
  if (input.attribution.ip) userData.client_ip_address = input.attribution.ip
  if (input.attribution.ua) userData.client_user_agent = input.attribution.ua

  const payload: Record<string, unknown> = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.trunc(input.eventTime),
      event_id: input.eventId,
      action_source: 'website',
      event_source_url: input.eventSourceUrl,
      user_data: userData,
      custom_data: {
        value: input.value,
        currency: input.currency,
        content_name: input.contentName,
      },
    }],
  }
  if (input.testEventCode) payload.test_event_code = input.testEventCode
  return payload
}

export type CapiOutcome =
  | { sent: true }
  | { sent: false; reason: 'no-consent' | 'not-configured' | 'demo' | 'http-error' | 'network-error' }

/**
 * Manda la compra a Meta. No lanza nunca: devuelve por qué no se mandó.
 *
 * Idempotencia: quien llama solo debe invocarla en el alta genuina de la
 * compra (ver `genuineInsert` en provision-registration.ts). Si aun así
 * llegara repetida, Meta descarta el duplicado por `event_id`.
 */
export async function sendPurchaseToMeta(
  input: PurchaseEventInput,
  opts: { isDemo?: boolean } = {},
): Promise<CapiOutcome> {
  // 1. Consentimiento primero: si no lo hay, ni se mira la configuración.
  if (!input.attribution.marketingConsent) return { sent: false, reason: 'no-consent' }

  // 2. Preview y local escriben en la misma BD que producción; que además
  //    inflaran el píxel real haría el dato inservible.
  if (opts.isDemo) return { sent: false, reason: 'demo' }

  const token = process.env.META_CAPI_TOKEN
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  // Fail-closed: sin token o sin píxel no se intenta nada. El píxel tiene que
  // ser el MISMO que el del navegador o Meta no deduplicaría.
  if (!token || !pixelId) return { sent: false, reason: 'not-configured' }

  const payload = buildPurchaseEvent({
    ...input,
    testEventCode: input.testEventCode ?? process.env.META_TEST_EVENT_CODE ?? null,
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    )
    if (!res.ok) {
      // El cuerpo del error de Meta no lleva PII, pero sí el motivo real
      // (token caducado, píxel que no existe). Sin él, depurar es adivinar.
      const detail = await res.text().catch(() => '')
      console.error('[meta-capi] Meta rechazó el evento: %s %s', res.status, detail.slice(0, 300))
      return { sent: false, reason: 'http-error' }
    }
    return { sent: true }
  } catch (e) {
    // Timeout, DNS, red. La venta ya está hecha y el acceso concedido; esto es
    // solo medición.
    console.error('[meta-capi] no se pudo enviar la compra: %s', e instanceof Error ? e.message : String(e))
    return { sent: false, reason: 'network-error' }
  } finally {
    clearTimeout(timer)
  }
}
