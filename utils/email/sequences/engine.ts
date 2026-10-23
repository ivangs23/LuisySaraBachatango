import type { SequenceStep } from './types'

const DIA_MS = 24 * 60 * 60 * 1000

/** Días completos transcurridos desde el alta. */
export function daysSince(consentAt: Date, now: Date): number {
  return Math.floor((now.getTime() - consentAt.getTime()) / DIA_MS)
}

/**
 * Pasos que se le podrían mandar hoy a una persona, en orden. Quien llama
 * coge el primero que tenga contenido y manda solo ese: un correo por persona
 * y ejecución, aunque el cron haya estado parado y vaya atrasada.
 *
 * - `desde`: primer paso que gestiona quien llama (el cron empieza en el 2;
 *   el 1 lo manda el formulario en el acto).
 * - Nunca un paso anterior al último enviado: si uno se saltó (p. ej. el
 *   testimonio, que no existe todavía) y después aparece, llegaría fuera de
 *   orden a quien ya recibió los siguientes.
 */
export function pendingSteps(
  steps: readonly SequenceStep[],
  sent: ReadonlySet<number>,
  days: number,
  desde: number,
): SequenceStep[] {
  const ultimo = Math.max(0, ...sent)
  return steps.filter((s) =>
    s.step >= desde &&
    s.step > ultimo &&
    !sent.has(s.step) &&
    s.delayDays <= days,
  )
}
