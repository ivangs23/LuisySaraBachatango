import 'server-only'
import { unstable_cache } from 'next/cache'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { requireAdmin } from '@/utils/auth/require-admin'
import { listSentEmails, type SentEmail, type ResendLogError } from '@/utils/email/resend-log'
import { PURCHASE_CONFIRMATION_SUBJECT } from '@/utils/email/purchase-confirmation'
import { FREE_CLASSES_SUBJECT } from '@/utils/email/sequences/nutricion'

/**
 * ¿Le salió el correo a cada comprador y a cada alta de las clases gratis?
 *
 * Cruza las compras y las altas de la BD con el registro de Resend
 * (`listSentEmails`), sin tabla propia: Resend ya sabe qué salió y qué pasó
 * después, y lo sabe también de lo enviado antes de que existiera este panel.
 * Una fila sin correo en Resend es un correo que no salió.
 *
 * Nació del 23-27 de octubre de 2026: la clave de Resend de producción dejó de
 * valer, no salió ni un correo durante cuatro días y nadie lo vio hasta que un
 * comprador escribió.
 */

/** Etiqueta de caché del contador del menú. El reenvío manual la invalida. */
export const EMAIL_STATUS_TAG = 'admin-email-status'

/** Días que se miran. Resend guarda el registro unos 30: más atrás no hay con qué comparar. */
export const DIAS = 28

const DAY_MS = 86_400_000
/** Lo que puede tardar un correo en aparecer en Resend. Antes, «sin correo» todavía no es un fallo. */
const GRACIA_MS = 10 * 60_000
/** Holgura entre el reloj de la BD y el de Resend al buscar el correo de una fila. */
const MARGEN_MS = 10 * 60_000

export type EstadoCorreo =
  | 'entregado'
  | 'en-camino'
  | 'rebotado'
  | 'spam'
  | 'fallido'
  | 'no-enviado'
  /** La web no manda este correo en este caso (compra con la sesión iniciada, alta manual). */
  | 'no-aplica'
  /** No se pudo leer Resend. */
  | 'desconocido'

export type FilaCorreo = {
  /** Lo que necesita el botón: id de la compra, o el email del alta. */
  ref: string
  email: string
  nombre: string | null
  /** ISO de la compra o del alta. */
  at: string
  /** Curso comprado, o vacío en las altas. */
  detalle: string
  estado: EstadoCorreo
  /** ISO del último correo encontrado en Resend, si lo hay. */
  enviadoAt: string | null
  /** Se puede mandar (otra vez) desde el panel. */
  reenviable: boolean
  /** Hay que hacer algo: cuenta para el aviso del menú. */
  necesitaAccion: boolean
  nota: string | null
}

export type PanelCorreos = {
  resend: { ok: true } | { ok: false; reason: ResendLogError }
  errorBd: boolean
  compras: FilaCorreo[]
  clasesGratis: FilaCorreo[]
  /** Filas con `necesitaAccion`. */
  pendientes: number
}

export function estadoDeEvento(lastEvent: string): EstadoCorreo {
  switch (lastEvent) {
    case 'delivered':
    case 'opened':
    case 'clicked':
      return 'entregado'
    case 'bounced':
      return 'rebotado'
    case 'complained':
      return 'spam'
    case 'failed':
    case 'canceled':
      return 'fallido'
    default:
      // sent, queued, scheduled, delivery_delayed: Resend lo tiene y lo está entregando.
      return 'en-camino'
  }
}

/** El correo más reciente con ese asunto a esa dirección desde `desdeMs`. */
export function buscarCorreo(enviados: SentEmail[], email: string, asunto: string, desdeMs: number): SentEmail | null {
  const destino = email.toLowerCase()
  let mejor: SentEmail | null = null
  for (const e of enviados) {
    if (e.subject !== asunto || e.createdAt < desdeMs || !e.to.includes(destino)) continue
    if (!mejor || e.createdAt > mejor.createdAt) mejor = e
  }
  return mejor
}

export function clasificar(opts: {
  encontrado: SentEmail | null
  resendOk: boolean
  atMs: number
  nowMs: number
  /** La web manda este correo sola en este caso. */
  seEnviaSolo: boolean
}): EstadoCorreo {
  if (!opts.resendOk) return 'desconocido'
  if (opts.encontrado) return estadoDeEvento(opts.encontrado.lastEvent)
  if (!opts.seEnviaSolo) return 'no-aplica'
  if (opts.nowMs - opts.atMs < GRACIA_MS) return 'en-camino'
  return 'no-enviado'
}

const FALLOS: readonly EstadoCorreo[] = ['no-enviado', 'fallido', 'rebotado']

type Compra = { id: string; user_id: string; course_id: string; created_at: string; source: string | null; refunded_at: string | null }
type Alta = { email: string; consent_at: string | null; subscribed_at: string; unsubscribed_at: string | null }

async function cargarPanel(nowMs: number): Promise<PanelCorreos> {
  const sb = createSupabaseAdmin()
  const sinceMs = nowMs - DIAS * DAY_MS
  const since = new Date(sinceMs).toISOString()

  const [comprasRes, altasRes, resend] = await Promise.all([
    sb.from('course_purchases')
      .select('id, user_id, course_id, created_at, source, refunded_at')
      .eq('is_demo', false)
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    sb.from('newsletter_subscribers')
      .select('email, consent_at, subscribed_at, unsubscribed_at')
      .eq('consent_source', 'clase_gratis')
      .gte('consent_at', since)
      .order('consent_at', { ascending: false }),
    listSentEmails(sinceMs - MARGEN_MS),
  ])

  const compras = (comprasRes.data ?? []) as Compra[]
  const altas = (altasRes.data ?? []) as Alta[]
  const userIds = [...new Set(compras.map((c) => c.user_id))]
  const courseIds = [...new Set(compras.map((c) => c.course_id))]
  const [perfilesRes, cursosRes] = await Promise.all([
    userIds.length
      ? sb.from('profiles').select('id, email, full_name').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    courseIds.length
      ? sb.from('courses').select('id, title').in('id', courseIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const errorBd = !!(comprasRes.error || altasRes.error || perfilesRes.error || cursosRes.error)

  const perfiles = new Map((perfilesRes.data ?? []).map((p) => [p.id as string, p as { email: string | null; full_name: string | null }]))
  const cursos = new Map((cursosRes.data ?? []).map((c) => [c.id as string, c.title as string]))
  const enviados = resend.ok ? resend.emails : []

  const filasCompras: FilaCorreo[] = compras.map((c) => {
    const perfil = perfiles.get(c.user_id)
    const email = (perfil?.email ?? '').toLowerCase()
    const atMs = Date.parse(c.created_at)
    const seEnviaSolo = c.source === 'landing'
    const encontrado = email ? buscarCorreo(enviados, email, PURCHASE_CONFIRMATION_SUBJECT, atMs - MARGEN_MS) : null
    const estado = clasificar({ encontrado, resendOk: resend.ok, atMs, nowMs, seEnviaSolo })
    const reembolsada = !!c.refunded_at
    return {
      ref: c.id,
      email,
      nombre: perfil?.full_name ?? null,
      at: c.created_at,
      detalle: cursos.get(c.course_id) ?? 'Curso',
      estado,
      enviadoAt: encontrado ? new Date(encontrado.createdAt).toISOString() : null,
      // Un reembolso ya no tiene acceso: un «ya tienes acceso» sería falso.
      reenviable: !!email && !reembolsada && estado !== 'spam',
      necesitaAccion: !reembolsada && FALLOS.includes(estado),
      nota: reembolsada
        ? 'Reembolsada'
        : estado === 'spam'
          ? 'Lo marcó como spam: no reenviar'
          : estado === 'no-aplica'
            ? c.source === 'web'
              ? 'Compró con la sesión iniciada: la web no manda este correo'
              : 'Acceso dado a mano: la web no manda este correo'
            : null,
    }
  })

  // Quien ya ha entrado en su cuenta no está bloqueado aunque le faltara el
  // correo: se dice, y no cuenta para el aviso. Solo se pregunta por las filas
  // con fallo, que son pocas.
  await Promise.all(filasCompras.filter((f) => f.necesitaAccion).map(async (f) => {
    const compra = compras.find((c) => c.id === f.ref)!
    const { data } = await sb.auth.admin.getUserById(compra.user_id)
    if (data?.user?.last_sign_in_at) {
      f.necesitaAccion = false
      f.nota = 'Ya ha entrado en su cuenta'
    } else if (data?.user) {
      f.nota = 'Todavía no ha entrado en su cuenta'
    }
  }))

  const filasAltas: FilaCorreo[] = altas.map((a) => {
    const email = a.email.toLowerCase()
    const at = a.consent_at ?? a.subscribed_at
    const atMs = Date.parse(at)
    const encontrado = buscarCorreo(enviados, email, FREE_CLASSES_SUBJECT, atMs - MARGEN_MS)
    const estado = clasificar({ encontrado, resendOk: resend.ok, atMs, nowMs, seEnviaSolo: true })
    const deBaja = !!a.unsubscribed_at
    return {
      ref: email,
      email,
      nombre: null,
      at,
      detalle: '',
      estado,
      enviadoAt: encontrado ? new Date(encontrado.createdAt).toISOString() : null,
      // Es correo comercial: a quien se dio de baja no se le manda nada.
      reenviable: !deBaja && estado !== 'spam',
      necesitaAccion: !deBaja && FALLOS.includes(estado),
      nota: deBaja ? 'Se dio de baja' : estado === 'spam' ? 'Lo marcó como spam: no reenviar' : null,
    }
  })

  return {
    resend: resend.ok ? { ok: true } : { ok: false, reason: resend.reason },
    errorBd,
    compras: filasCompras,
    clasesGratis: filasAltas,
    pendientes: [...filasCompras, ...filasAltas].filter((f) => f.necesitaAccion).length,
  }
}

/** Todo el panel, al momento. */
export async function getEmailPanel(): Promise<PanelCorreos> {
  await requireAdmin()
  return cargarPanel(Date.now())
}

export type AvisoCorreos = {
  pendientes: number
  /** Resend rechaza la clave o no hay: no sale NINGÚN correo. */
  sinEnvio: boolean
}

/**
 * Lo que enseña el menú del admin. Cacheado 5 minutos para no leer Resend en
 * cada clic por el panel; el reenvío manual lo invalida al momento.
 */
const avisoCacheado = unstable_cache(
  async (): Promise<AvisoCorreos> => {
    const panel = await cargarPanel(Date.now())
    const sinEnvio = !panel.resend.ok && (panel.resend.reason === 'clave-invalida' || panel.resend.reason === 'sin-clave')
    return { pendientes: panel.pendientes, sinEnvio }
  },
  ['admin-email-aviso'],
  { revalidate: 300, tags: [EMAIL_STATUS_TAG] },
)

/** Nunca lanza: un fallo aquí no puede tumbar el menú del admin. */
export async function getEmailAviso(): Promise<AvisoCorreos> {
  try {
    await requireAdmin()
    return await avisoCacheado()
  } catch {
    return { pendientes: 0, sinEnvio: false }
  }
}
