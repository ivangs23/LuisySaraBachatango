import * as Sentry from '@sentry/nextjs'

/**
 * Avisa de un fallo que le cuesta dinero al negocio o deja a alguien sin lo
 * que ha pagado.
 *
 * Existe porque los fallos de aprovisionamiento se registraban solo con
 * `console.error`, y Sentry no lleva la integración `CaptureConsole`: acababan
 * únicamente en los logs de Vercel, que nadie mira. Un comprador podía quedarse
 * sin acceso y no enterarse nadie hasta que escribiera.
 *
 * No se activa `CaptureConsole` a propósito: mandaría a Sentry todos los
 * `console.error` de la aplicación, incluidos los ruidosos e inevitables (por
 * ejemplo, los navegadores que bloquean el almacenamiento generan cientos al
 * día). Enterrar los avisos que importan bajo ese ruido es como no tenerlos.
 *
 * Nunca lanza: avisar de un problema no puede provocar otro.
 */
export function alertaCritica(
  mensaje: string,
  contexto: Record<string, string | number | boolean | null | undefined> = {},
): void {
  // Se mantiene el log: es lo que se ve al depurar en los logs de Vercel.
  console.error(`[CRÍTICO] ${mensaje}`, contexto)
  try {
    Sentry.captureMessage(mensaje, {
      level: 'error',
      // `seccion` permite filtrar y alertar en Sentry solo por lo que afecta a
      // una venta, sin mezclarlo con los errores de front.
      tags: { seccion: 'aprovisionamiento' },
      extra: contexto,
    })
  } catch {
    // Sentry caído o sin configurar: el console.error de arriba ya dejó rastro.
  }
}

/**
 * Deja constancia de un enlace por email que no se pudo canjear.
 *
 * Va en `warning` y no en `error`, y con su propia `seccion`, por dos razones
 * opuestas que hay que respetar a la vez.
 *
 * Un enlace caducado es comportamiento NORMAL: la gente abre el correo al día
 * siguiente. Tratarlo como error llenaría Sentry de ruido y enterraría los
 * avisos de `alertaCritica`, que es justo lo que ese helper existe para evitar.
 *
 * Pero el silencio absoluto sale caro: el restablecimiento de contraseña estuvo
 * roto desde que existía —3 intentos, 0 completados— y nadie pudo verlo porque
 * los dos routes de auth se tragaban el error. Con esto, «300 fallos esta
 * semana, todos `flow_state_expired`» se ve de un vistazo, que es la señal que
 * habría destapado el fallo en su primer día.
 *
 * Nunca recibe el token: el contexto lo arma quien llama, y solo con el tipo de
 * enlace y el código del error.
 *
 * Nunca lanza: avisar de un problema no puede provocar otro.
 */
export function avisoAuth(
  mensaje: string,
  contexto: Record<string, string | number | boolean | null | undefined> = {},
): void {
  console.warn(`[auth] ${mensaje}`, contexto)
  try {
    Sentry.captureMessage(mensaje, {
      level: 'warning',
      tags: { seccion: 'auth' },
      extra: contexto,
    })
  } catch {
    // Sentry caído o sin configurar: el console.warn de arriba ya dejó rastro.
  }
}
