import 'server-only'
import { makeUnsubscribeToken } from '@/utils/newsletter/unsubscribe-token'
import { esc } from './layout'

export type PieDeBaja = {
  url: string
  /** Párrafo para `renderEmail({ pieExtra })`, ya escapado. */
  html: string
  /** Lo mismo para `renderTexto({ pieExtra })`. */
  text: string
  /** RFC 8058: el botón de baja que Gmail y Outlook enseñan junto al remitente. */
  headers: Record<string, string>
}

/**
 * Pie de baja de toda comunicación comercial (LSSI art. 21): enlace visible y
 * cabeceras List-Unsubscribe. La cabecera reduce mucho las marcas de spam,
 * porque quien no quiere seguir se da de baja en vez de denunciar el correo.
 *
 * Devuelve null sin NEWSLETTER_UNSUBSCRIBE_SECRET: sin enlace de baja no se
 * puede enviar comunicación comercial legalmente, y quien llama no envía.
 */
export function pieDeBaja(email: string, motivo: string): PieDeBaja | null {
  const token = makeUnsubscribeToken(email)
  if (!token) return null

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'
  const url = `${base}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`

  const html = `<p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8b857c;">
      ${esc(motivo)}
      <a href="${esc(url)}" style="color:#8b857c;">Darse de baja</a>.
    </p>`

  return {
    url,
    html,
    text: `${motivo} Darse de baja: ${url}`,
    headers: {
      'List-Unsubscribe': `<${url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
