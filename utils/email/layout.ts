import { ENTITY } from '@/utils/legal/entity'

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${ENTITY.domain}`

/**
 * Origen del logo del correo, deducido del dominio de la entidad y NO de
 * NEXT_PUBLIC_BASE_URL.
 *
 * Un cliente de correo no tiene "localhost": si esa variable apunta a un
 * entorno de desarrollo, la imagen se rompe en la bandeja de TODOS los
 * compradores y no hay forma de enterarse hasta que alguien lo comenta. Pasó
 * en una prueba y el correo salió con `http://localhost:3000/icon.png`.
 *
 * Los enlaces sí siguen usando BASE: en una preview conviene que apunten a esa
 * preview, y si ahí estuvieran mal se nota al primer clic.
 */
const ORIGEN_LOGO = `https://${ENTITY.domain}`

/** El remitente único de todo el correo transaccional. */
export const FROM = `${ENTITY.tradeName === 'LUIS Y SARA BACHATANGO' ? 'Luis y Sara Bachatango' : ENTITY.tradeName} <noreply@${ENTITY.domain}>`

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/* -------------------------------------------------------------------------
   Paleta. Fondo claro a propósito, no el negro de la web: los clientes de
   correo con modo oscuro invierten los colores de forma impredecible, y un
   diseño oscuro acaba con texto ilegible en la mitad de las bandejas. El
   crema es además el fondo del propio icono, así que la cabecera queda
   integrada en vez de con el logo recortado sobre otro color.
   ---------------------------------------------------------------------- */
const C = {
  papel: '#faf7ee',
  tarjeta: '#ffffff',
  texto: '#1a1a1a',
  suave: '#5f5a52',
  tenue: '#8b857c',
  oro: '#a8823c',
  borde: '#e6e0d2',
}

const FUENTE = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

export type Boton = { texto: string; url: string }

/**
 * Envoltorio común de los correos transaccionales.
 *
 * Va maquetado con tablas y estilos en línea, no porque sea bonito sino
 * porque es lo único que renderiza igual en Outlook (motor de Word), Gmail
 * (que descarta gran parte del CSS en `<style>`) y Apple Mail.
 *
 * `preheader` es la línea de vista previa que la bandeja enseña junto al
 * asunto. Si no se define, el cliente coge el primer texto que encuentre —
 * normalmente «Ver en el navegador» o el alt del logo, que queda pobre.
 */
export function renderEmail(opts: {
  preheader: string
  titulo: string
  parrafos: string[]
  boton?: Boton
  /** Bloque destacado bajo el botón (datos del pedido, avisos). */
  nota?: string
  /** Pie extra antes del legal, ya escapado. Se usa para la baja. */
  pieExtra?: string
}): string {
  const { preheader, titulo, parrafos, boton, nota, pieExtra } = opts

  const cuerpo = parrafos.map(p =>
    `<p style="margin:0 0 16px;font-family:${FUENTE};font-size:16px;line-height:1.65;color:${C.suave};">${p}</p>`
  ).join('')

  // Botón "a prueba de balas": una tabla con fondo, no un <a> con padding,
  // porque Outlook ignora el padding de los enlaces y el botón se descuadra.
  const cta = boton ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
      <tr>
        <td align="center" bgcolor="${C.oro}" style="border-radius:999px;">
          <a href="${esc(boton.url)}"
             style="display:inline-block;padding:15px 38px;font-family:${FUENTE};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">
            ${esc(boton.texto)}
          </a>
        </td>
      </tr>
    </table>` : ''

  const bloqueNota = nota ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
      <tr>
        <td style="padding:14px 18px;background:${C.papel};border-left:3px solid ${C.oro};border-radius:4px;
                   font-family:${FUENTE};font-size:14px;line-height:1.6;color:${C.suave};">
          ${nota}
        </td>
      </tr>
    </table>` : ''

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${C.papel};">
  <!-- Preheader: se muestra en la lista de la bandeja, nunca en el cuerpo. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.papel};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

          <!-- Cabecera con el logo -->
          <tr>
            <td align="center" style="padding:0 0 24px;">
              <img src="${ORIGEN_LOGO}/icon.png" width="64" height="64" alt="${esc(ENTITY.tradeName)}"
                   style="display:block;width:64px;height:64px;border:0;border-radius:12px;">
            </td>
          </tr>

          <!-- Tarjeta -->
          <tr>
            <td style="background:${C.tarjeta};border:1px solid ${C.borde};border-radius:14px;padding:36px 34px;">
              <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:1.3;font-weight:normal;color:${C.texto};">
                ${esc(titulo)}
              </h1>
              ${cuerpo}
              ${cta}
              ${bloqueNota}
            </td>
          </tr>

          <!-- Pie -->
          <tr>
            <td style="padding:24px 20px 0;">
              ${pieExtra ?? ''}
              <p style="margin:0 0 8px;font-family:${FUENTE};font-size:12px;line-height:1.6;color:${C.tenue};">
                ${esc(ENTITY.legalName)} · NIF ${esc(ENTITY.taxId)}<br>
                ${esc(ENTITY.addressShort)}<br>
                <a href="mailto:${esc(ENTITY.email)}" style="color:${C.tenue};">${esc(ENTITY.email)}</a>
              </p>
              <p style="margin:0;font-family:${FUENTE};font-size:12px;line-height:1.6;color:${C.tenue};">
                <a href="${BASE}/legal/privacy" style="color:${C.tenue};">Privacidad</a> ·
                <a href="${BASE}/legal/terms" style="color:${C.tenue};">Condiciones</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Versión en texto plano. No es opcional: un correo sin `text/plain` puntúa
 * peor en los filtros antispam, y es lo único que ven los lectores de
 * pantalla en modo texto y los clientes que bloquean HTML.
 */
export function renderTexto(opts: {
  titulo: string
  parrafos: string[]
  boton?: Boton
  nota?: string
  pieExtra?: string
}): string {
  const quitarHtml = (s: string) =>
    s.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
     .replace(/<[^>]+>/g, '')
     .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
     .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
     .replace(/[ \t]+/g, ' ').trim()

  const partes = [
    opts.titulo,
    '',
    ...opts.parrafos.map(quitarHtml),
  ]
  if (opts.boton) partes.push('', `${opts.boton.texto}: ${opts.boton.url}`)
  if (opts.nota) partes.push('', quitarHtml(opts.nota))
  if (opts.pieExtra) partes.push('', quitarHtml(opts.pieExtra))
  partes.push(
    '',
    '---',
    `${ENTITY.legalName} · NIF ${ENTITY.taxId}`,
    ENTITY.addressShort,
    ENTITY.email,
  )
  return partes.join('\n')
}

/**
 * Envío por Resend. Centralizado para que ningún correo salga sin su versión
 * en texto y para no repetir el manejo de errores: un fallo de email nunca
 * puede tumbar la operación que lo dispara (compra o suscripción ya están
 * comprometidas en base de datos).
 */
export async function enviar(opts: {
  to: string
  subject: string
  html: string
  text: string
  /** Cabeceras extra, p. ej. List-Unsubscribe en los comerciales. */
  headers?: Record<string, string>
  /** Etiqueta para los logs. */
  etiqueta: string
}): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(opts.headers ? { headers: opts.headers } : {}),
      }),
    })
    if (!res.ok) {
      console.error(`[${opts.etiqueta}] resend failed`, res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.error(`[${opts.etiqueta}] resend threw`, e)
  }
}
