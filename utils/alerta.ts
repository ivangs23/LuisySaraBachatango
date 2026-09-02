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
