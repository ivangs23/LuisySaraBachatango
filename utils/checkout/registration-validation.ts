import { EMAIL_RE } from '@/utils/auth/email'

export type CleanRegistration = {
  fullName: string
  email: string
  marketingConsent: boolean
  /**
   * Consentimiento previo y expreso al inicio inmediato de la ejecución, con
   * reconocimiento de que ello hace perder el derecho de desistimiento
   * (art. 103.m RDL 1/2007). Casilla propia y obligatoria, separada de la
   * aceptación de términos: el artículo exige un acto específico, y una
   * casilla genérica de "acepto los términos" no lo prueba.
   */
  acceptDigitalExecution: boolean
}

export type RegistrationResult =
  | { ok: true; data: CleanRegistration }
  | { ok: false; code: string }

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

function marcada(v: FormDataEntryValue | null): boolean {
  return v === 'on' || v === 'true'
}

export function validateRegistration(
  raw: Record<string, FormDataEntryValue | null>,
): RegistrationResult {
  const fullName = str(raw.fullName)
  const email = str(raw.email).toLowerCase()

  if (fullName.length < 2 || fullName.length > 120) return { ok: false, code: 'invalid_name' }
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, code: 'invalid_email' }

  // La fecha de nacimiento se pedía solo para esto. Las condiciones exigen 16
  // años (app/legal/terms/page.tsx:40) y una casilla lo declara igual de bien,
  // sin cobrar un campo de fecha a cada comprador ni guardar un dato que
  // ninguna pantalla de la aplicación lee.
  if (!marcada(raw.isAdult)) return { ok: false, code: 'age_required' }
  if (!marcada(raw.acceptTerms)) return { ok: false, code: 'terms_required' }
  if (!marcada(raw.acceptDigitalExecution)) return { ok: false, code: 'digital_execution_required' }

  return {
    ok: true,
    data: { fullName, email, marketingConsent: marcada(raw.marketingConsent), acceptDigitalExecution: true },
  }
}
