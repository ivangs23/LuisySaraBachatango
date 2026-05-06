import 'server-only'
import { cookies } from 'next/headers'
import type { Dictionary, Locale } from '@/utils/i18n/types'

const LOADERS: Record<Locale, () => Promise<Dictionary>> = {
  es: () => import('@/utils/i18n/dictionaries/es').then(m => m.es),
  en: () => import('@/utils/i18n/dictionaries/en').then(m => m.en),
  fr: () => import('@/utils/i18n/dictionaries/fr').then(m => m.fr),
  de: () => import('@/utils/i18n/dictionaries/de').then(m => m.de),
  it: () => import('@/utils/i18n/dictionaries/it').then(m => m.it),
  ja: () => import('@/utils/i18n/dictionaries/ja').then(m => m.ja),
}

export async function getDict(): Promise<Dictionary> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('locale')?.value as Locale | undefined
  const locale = (raw && raw in LOADERS) ? raw : 'es'
  return LOADERS[locale]()
}
