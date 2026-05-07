import 'server-only'
import { cookies } from 'next/headers'
import type { Locale } from '@/utils/i18n/types'

const VALID_LOCALES: ReadonlySet<Locale> = new Set(['es', 'en', 'fr', 'de', 'it', 'ja'])

export async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('locale')?.value as Locale | undefined
  return raw && VALID_LOCALES.has(raw) ? raw : 'es'
}
