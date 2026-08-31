import 'server-only'
import { createHash, createHmac } from 'node:crypto'

/**
 * Identificador efímero de visitante, sin cookie y sin datos personales.
 *
 *   sal_del_día  = hmac_sha256(LANDING_ANALYTICS_SECRET, 'YYYY-MM-DD')
 *   visitor_hash = sha256(sal_del_día || ip || user_agent)
 *
 * La IP y el user-agent entran en el cálculo y se descartan: nunca se guardan.
 * La sal cambia a medianoche UTC, así que el mismo visitante recibe otro hash
 * mañana — no hay seguimiento entre días, por diseño.
 *
 * Riesgo residual asumido: quien tuviera el secreto Y una IP concreta podría
 * recalcular el hash de ese día y comprobar si esa IP estuvo. Exige las dos
 * cosas y solo funciona dentro del mismo día. La alternativa (sal aleatoria
 * rotada y destruida) pide tabla y tarea de rotación, y no compensa a esta
 * escala. Ver el spec.
 *
 * Fail-closed: sin secreto devuelve null y no se mide nada.
 */
export function dailyVisitorHash(
  ip: string,
  userAgent: string | null,
  now: Date,
): string | null {
  const secret = process.env.LANDING_ANALYTICS_SECRET
  if (!secret) return null

  const day = now.toISOString().slice(0, 10) // YYYY-MM-DD en UTC
  const dailySalt = createHmac('sha256', secret).update(day).digest('hex')

  return createHash('sha256')
    .update(`${dailySalt}|${ip}|${userAgent ?? ''}`)
    .digest('hex')
}

/**
 * Rastreadores y herramientas. Sin esto los números mienten: el monitor de
 * superficie pública pasa cada 6 h y Lighthouse cada vez que se mide.
 *
 * Sin user-agent se considera bot: un navegador real siempre manda uno.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|curl|wget|python-requests|axios|node-fetch|headless|lighthouse|pingdom|monitor|preview|facebookexternalhit|whatsapp|telegram|embedly|quora|pinterest|vercel|gtmetrix|phantomjs|puppeteer|playwright/i

export function isBot(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true
  return BOT_PATTERN.test(userAgent)
}
