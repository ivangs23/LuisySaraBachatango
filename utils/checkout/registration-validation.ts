import { EMAIL_RE } from '@/utils/auth/email'
import { MIN_PASSWORD_LENGTH } from '@/utils/auth/password'
import { isValidCountry } from '@/utils/i18n/countries'

export type CleanRegistration = {
  fullName: string
  email: string
  password: string
  country: string
  city: string
  dateOfBirth: string
  danceLevel: string
  phone: string | null
  marketingConsent: boolean
}

export type RegistrationResult =
  | { ok: true; data: CleanRegistration }
  | { ok: false; code: string }

const DANCE_LEVELS = new Set(['principiante', 'intermedio', 'avanzado'])
const PHONE_RE = /^[+()\d][\d\s()-]{5,19}$/

function str(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

function ageFrom(iso: string): number | null {
  const d = new Date(iso + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getUTCFullYear() - d.getUTCFullYear()
  const m = now.getUTCMonth() - d.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--
  return age
}

export function validateRegistration(
  raw: Record<string, FormDataEntryValue | null>,
): RegistrationResult {
  const fullName = str(raw.fullName)
  const email = str(raw.email).toLowerCase()
  const password = typeof raw.password === 'string' ? raw.password : ''
  const repeatPassword = typeof raw.repeatPassword === 'string' ? raw.repeatPassword : ''
  const country = str(raw.country)
  const city = str(raw.city)
  const dateOfBirth = str(raw.dateOfBirth)
  const danceLevel = str(raw.danceLevel)
  const phoneRaw = str(raw.phone)
  const marketingConsent = raw.marketingConsent === 'on' || raw.marketingConsent === 'true'
  const acceptTerms = raw.acceptTerms === 'on' || raw.acceptTerms === 'true'

  if (!fullName) return { ok: false, code: 'missing' }
  if (!EMAIL_RE.test(email)) return { ok: false, code: 'invalid_email' }
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, code: 'password_too_short' }
  if (!(/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)))
    return { ok: false, code: 'password_weak' }
  if (password !== repeatPassword) return { ok: false, code: 'password_mismatch' }
  if (!isValidCountry(country)) return { ok: false, code: 'invalid_country' }
  if (!city) return { ok: false, code: 'missing' }
  const age = ageFrom(dateOfBirth)
  if (age === null || age < 16 || age > 100) return { ok: false, code: 'invalid_birthdate' }
  if (!DANCE_LEVELS.has(danceLevel)) return { ok: false, code: 'missing' }
  if (phoneRaw && !PHONE_RE.test(phoneRaw)) return { ok: false, code: 'invalid_phone' }
  if (!acceptTerms) return { ok: false, code: 'terms_not_accepted' }

  return {
    ok: true,
    data: {
      fullName, email, password, country, city, dateOfBirth, danceLevel,
      phone: phoneRaw || null, marketingConsent,
    },
  }
}
