import type { Boton } from '../layout'

/** Lo que un paso puede necesitar saber para escribirse. */
export interface StepContext {
  /** Destinatario, ya normalizado. */
  email: string
  /** Origen de los enlaces (NEXT_PUBLIC_BASE_URL). */
  base: string
  /** Temario real del curso, o null si la BD no respondió. */
  curriculum: { modules: number; lessons: number; duration: string } | null
  /** Precio que se cobra hoy, en euros, o null si la BD no respondió. */
  price: number | null
}

export interface StepContent {
  subject: string
  /** Línea de vista previa junto al asunto en la bandeja. */
  preheader: string
  titulo: string
  /** HTML ya escapado: va tal cual al cuerpo del correo. */
  parrafos: string[]
  boton?: Boton
}

export interface SequenceStep {
  step: number
  /** Días desde el alta (`newsletter_subscribers.consent_at`). */
  delayDays: number
  /**
   * El correo de este paso para esta persona, o null si hoy no se puede
   * enviar (falta material real o un dato de la BD). Un null no consume el
   * paso: se vuelve a intentar en la siguiente ejecución.
   */
  content: (ctx: StepContext) => StepContent | null
}

export interface Sequence {
  /** Valor de `email_sends.sequence`. */
  name: string
  steps: readonly SequenceStep[]
}
