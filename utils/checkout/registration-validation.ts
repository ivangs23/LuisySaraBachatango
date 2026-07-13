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
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3])
  const d = new Date(Date.UTC(y, mo - 1, da))
  // reject rolled-over / impossible dates (e.g. 2020-02-30 -> Mar 1)
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== da) return null
  const now = new Date()
  let age = now.getUTCFullYear() - d.getUTCFullYear()
  const mm = now.getUTCMonth() - d.getUTCMonth()
  if (mm < 0 || (mm === 0 && now.getUTCDate() < d.getUTCDate())) age--
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
