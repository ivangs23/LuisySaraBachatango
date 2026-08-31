/**
 * Genera el SQL de seed de las tablas de contenido de la landing a partir de
 * los diccionarios y de los valores hoy hardcodeados en los componentes.
 *
 * Se genera en vez de transcribirse: son 3 testimonios y 3 preguntas por 6
 * idiomas, y copiarlos a mano invita a erratas silenciosas.
 *
 * Uso:  npx tsx scripts/generate-landing-seed.ts
 * La salida se pega en supabase/2026_08_landing_content.sql
 */
import { dictionaries } from '../utils/dictionaries'
import type { Locale } from '../utils/i18n/types'

const LOCALES: Locale[] = ['es', 'en', 'fr', 'de', 'it', 'ja']

/** Escapa una cadena para un literal SQL. */
function sql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function jsonbFor(pick: (loc: Locale) => string): string {
  const obj: Record<string, string> = {}
  for (const loc of LOCALES) obj[loc] = pick(loc)
  return `${sql(JSON.stringify(obj))}::jsonb`
}

// Valores actuales de components/Hero.tsx y app/sobre-nosotros/AboutClient.tsx,
// guardados sin signo: el '+' lo pone cada vista.
const STATS: { key: string; value: string; position: number }[] = [
  { key: 'years', value: '25', position: 1 },
  { key: 'students', value: '500', position: 2 },
  { key: 'countries', value: '30', position: 3 },
  { key: 'titles', value: '100', position: 4 },
]

// Los nombres viven hoy en components/Testimonials.tsx, no en el diccionario.
const TESTIMONIAL_NAMES = ['Elena M.', 'Carlos R.', 'Sofía y Marc']

const lines: string[] = []

lines.push('-- Seed generado por scripts/generate-landing-seed.ts. No editar a mano:')
lines.push('-- volver a generarlo si cambian los diccionarios.')
lines.push('')

lines.push('insert into public.landing_stats (key, value, position) values')
lines.push(
  STATS.map((s) => `  (${sql(s.key)}, ${sql(s.value)}, ${s.position})`).join(',\n') +
    '\non conflict (key) do nothing;',
)
lines.push('')

lines.push('insert into public.landing_testimonials (name, quote, stars, position) values')
lines.push(
  TESTIMONIAL_NAMES.map((name, i) => {
    const k = `t${i + 1}` as 't1' | 't2' | 't3'
    return `  (${sql(name)}, ${jsonbFor((loc) => dictionaries[loc].testimonials[k].quote)}, 5, ${i + 1})`
  }).join(',\n') + ';',
)
lines.push('')

lines.push('insert into public.landing_faq (question, answer, position) values')
lines.push(
  [1, 2, 3]
    .map((n) => {
      const k = `q${n}` as 'q1' | 'q2' | 'q3'
      return `  (${jsonbFor((loc) => dictionaries[loc].faq[k].q)}, ${jsonbFor((loc) => dictionaries[loc].faq[k].a)}, ${n})`
    })
    .join(',\n') + ';',
)

console.log(lines.join('\n'))
