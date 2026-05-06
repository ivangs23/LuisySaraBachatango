// Aggregate dictionary kept for backwards compatibility with client code
// (LanguageContext bundles all locales today). Server-side code should prefer
// utils/get-dict.ts which loads only the active locale dynamically.

export type { Dictionary, Locale } from '@/utils/i18n/types'
export { LOCALES } from '@/utils/i18n/types'

import { es } from '@/utils/i18n/dictionaries/es'
import { en } from '@/utils/i18n/dictionaries/en'
import { fr } from '@/utils/i18n/dictionaries/fr'
import { de } from '@/utils/i18n/dictionaries/de'
import { it } from '@/utils/i18n/dictionaries/it'
import { ja } from '@/utils/i18n/dictionaries/ja'

export const dictionaries = { es, en, fr, de, it, ja } as const
