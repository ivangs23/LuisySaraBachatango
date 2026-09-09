import 'server-only'
import { renderEmail, renderTexto, enviar, esc } from './layout'

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'

/**
 * Confirmación posterior al pago. Se envía como ÚLTIMO paso del
 * aprovisionamiento, exactamente una vez por alta genuina. Nunca lanza: un
 * fallo de email no puede tumbar el webhook, porque la compra ya está
 * comprometida. No hace nada si falta RESEND_API_KEY.
 *
 * Es el primer correo que recibe alguien que acaba de pagar 119 €, así que
 * dice explícitamente CON QUÉ CONTRASEÑA entrar: es la duda número uno cuando
 * la cuenta se crea durante la compra y no antes.
 */
export async function sendPurchaseConfirmation(opts: {
  email: string
  fullName: string | null
  existingAccount: boolean
  /**
   * Enlace de un solo uso para fijar la contraseña (lo genera el
   * aprovisionamiento, tarea 5 de este plan). Ausente en dos casos: la
   * cuenta ya existía (`existingAccount: true`, entra con la de siempre), o
   * la compra quedó en vuelo con el flujo antiguo y ya trae contraseña
   * elegida en el checkout.
   */
  setPasswordUrl?: string
}): Promise<void> {
  const nombre = opts.fullName ? esc(opts.fullName.split(' ')[0]) : null
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'

  const titulo = opts.existingAccount ? 'Compra confirmada' : 'Ya tienes acceso al curso'

  const parrafos = opts.existingAccount
    ? [
        `${saludo} tu compra del <strong>CURSO BACHATANGO</strong> está confirmada y el acceso ya está activo en tu cuenta.`,
        `Como ya tenías cuenta con nosotros, entra con tu <strong>contraseña habitual</strong>.`,
      ]
    : opts.setPasswordUrl
      ? [
          `${saludo} tu compra del <strong>CURSO BACHATANGO</strong> está confirmada.`,
          'Solo queda un paso: elige tu contraseña y entras. Puedes hacerlo desde cualquier dispositivo.',
        ]
      : [
          `${saludo} tu compra del <strong>CURSO BACHATANGO</strong> está confirmada y tu cuenta ya está lista.`,
          `Entra con este mismo correo y la <strong>contraseña que elegiste durante la compra</strong>.`,
        ]

  parrafos.push(
    'Tienes acceso de por vida a las 28 lecciones, así que puedes ir a tu ritmo y volver a cualquier módulo cuando quieras.',
  )

  const nota = opts.existingAccount
    ? `¿No recuerdas tu contraseña? <a href="${BASE}/forgot-password" style="color:#a8823c;">Recupérala aquí</a> en un minuto.`
    : opts.setPasswordUrl
      ? `El enlace caduca y solo puede usarse una vez. Si se te pasa, entra en la web y pulsa <strong>«¿Olvidaste tu contraseña?»</strong>: tu compra ya está guardada.`
      : `Guarda este correo: aquí tienes el enlace de acceso siempre a mano. Si olvidas la contraseña, puedes <a href="${BASE}/forgot-password" style="color:#a8823c;">restablecerla</a>.`

  const boton = opts.setPasswordUrl
    ? { texto: 'Crea tu contraseña', url: opts.setPasswordUrl }
    : { texto: 'Entrar al curso', url: `${BASE}/login` }

  const html = renderEmail({
    preheader: 'Tu acceso al CURSO BACHATANGO ya está activo.',
    titulo,
    parrafos,
    boton,
    nota,
  })
  const text = renderTexto({ titulo, parrafos, boton, nota })

  await enviar({
    to: opts.email,
    subject: 'Tu acceso al CURSO BACHATANGO ya está activo',
    html,
    text,
    etiqueta: 'purchase-confirmation',
  })
}
