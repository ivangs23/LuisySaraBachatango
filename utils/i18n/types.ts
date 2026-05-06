import type { es } from '@/utils/i18n/dictionaries/es'

export type Locale = 'es' | 'en' | 'fr' | 'de' | 'it' | 'ja'
export const LOCALES = ['es', 'en', 'fr', 'de', 'it', 'ja'] as const

// Dictionary is the shape of a single locale's translations.
// Derived from the canonical 'es' locale file to avoid duplication.
export type Dictionary = typeof es
