// scripts/validate-i18n.ts
import { es } from '../utils/i18n/dictionaries/es'
import { en } from '../utils/i18n/dictionaries/en'
import { fr } from '../utils/i18n/dictionaries/fr'
import { de } from '../utils/i18n/dictionaries/de'
import { it } from '../utils/i18n/dictionaries/it'
import { ja } from '../utils/i18n/dictionaries/ja'

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || obj === undefined) return [prefix]
  if (typeof obj !== 'object') return [prefix]
  if (Array.isArray(obj)) return [prefix] // treat arrays as leaves
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k)
  )
}

const locales = { es, en, fr, de, it, ja } as const
const baseLocale: keyof typeof locales = 'es'
const baseKeys = new Set(flattenKeys(locales[baseLocale]))

let failed = false
const missing: Record<string, string[]> = {}

for (const [name, dict] of Object.entries(locales)) {
  if (name === baseLocale) continue
  const keys = new Set(flattenKeys(dict))
  const gaps: string[] = []
  for (const k of baseKeys) {
    if (!keys.has(k)) gaps.push(k)
  }
  if (gaps.length > 0) {
    missing[name] = gaps
    failed = true
  }
}

if (failed) {
  console.error('❌ i18n keys missing in some locales (vs es):\n')
  for (const [name, gaps] of Object.entries(missing)) {
    console.error(`  ${name}: ${gaps.length} missing`)
    for (const g of gaps.slice(0, 20)) console.error(`    - ${g}`)
    if (gaps.length > 20) console.error(`    ... and ${gaps.length - 20} more`)
    console.error('')
  }
  process.exit(1)
}

console.log('✅ i18n keys aligned across all locales.')
