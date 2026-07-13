const FROM = 'Luis y Sara Bachatango <noreply@luisysarabachatango.com>'
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://luisysarabachatango.com'

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/**
 * Post-payment confirmation. Sent as the LAST step of provisioning, exactly once
 * per genuine provision. Never throws: a failed email must not fail the webhook
 * (the purchase is already committed). No-op if RESEND_API_KEY is unset.
 */
export async function sendPurchaseConfirmation(opts: {
  email: string
  fullName: string | null
  existingAccount: boolean
}): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) return

  const hi = opts.fullName ? `Hola ${esc(opts.fullName)},` : 'Hola,'
  const html = opts.existingAccount
    ? `<h2>¡Compra confirmada! 🎉</h2><p>${hi} ya tienes acceso al curso. Como ya tenías una cuenta, entra con tu <b>contraseña habitual</b>. Si no la recuerdas, <a href="${BASE}/forgot-password">recupérala aquí</a>.</p><p><a href="${BASE}/login">Entrar al curso</a></p>`
    : `<h2>¡Bienvenido/a! 🎉</h2><p>${hi} tu compra está confirmada y tu cuenta lista. Entra con tu email y la <b>contraseña que elegiste</b> al comprar.</p><p><a href="${BASE}/login">Entrar al curso</a></p>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [opts.email],
        subject: 'Tu compra del CURSO BACHATANGO está lista',
        html,
      }),
    })
    if (!res.ok) {
      console.error('[purchase-confirmation] resend failed', res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.error('[purchase-confirmation] resend threw', e)
  }
}
