import 'server-only'
import { cookies } from 'next/headers'
import { LOCALES, type Locale } from '@/utils/i18n/types'

const VALID_LOCALES: ReadonlySet<Locale> = new Set(LOCALES)

export async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('locale')?.value as Locale | undefined
  return raw && VALID_LOCALES.has(raw) ? raw : 'es'
}
