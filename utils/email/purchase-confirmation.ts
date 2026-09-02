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
}): Promise<void> {
  const nombre = opts.fullName ? esc(opts.fullName.split(' ')[0]) : null
  const saludo = nombre ? `Hola ${nombre},` : 'Hola,'

  const titulo = opts.existingAccount ? 'Compra confirmada' : 'Ya tienes acceso al curso'

  const parrafos = opts.existingAccount
    ? [
        `${saludo} tu compra del <strong>CURSO BACHATANGO</strong> está confirmada y el acceso ya está activo en tu cuenta.`,
        `Como ya tenías cuenta con nosotros, entra con tu <strong>contraseña habitual</strong>.`,
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
    : `Guarda este correo: aquí tienes el enlace de acceso siempre a mano. Si olvidas la contraseña, puedes <a href="${BASE}/forgot-password" style="color:#a8823c;">restablecerla</a>.`

  const boton = { texto: 'Entrar al curso', url: `${BASE}/login` }

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
