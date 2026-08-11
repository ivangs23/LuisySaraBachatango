/**
 * Verifica qué puede leer un visitante anónimo. Solo lee: no escribe nada.
 *
 * Uso:
 *   npx tsx scripts/verify-anon-read.ts
 *
 * Ejecutar ANTES y DESPUÉS de aplicar
 * `supabase/2026_08_fix_anon_read_admin_check.sql`.
 *
 * Antes  -> courses/lessons/events fallan con "permission denied for table profiles".
 * Después -> los tres pasan, y profiles.role DEBE seguir denegado.
 */
import 'dotenv/config'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const anon = createClient(url, anonKey)

interface Check {
  label: string
  run: () => Promise<{ error: { message: string } | null; count: number }>
  /** true = debe funcionar; false = debe seguir denegado */
  expectAllowed: boolean
}

async function select(table: string, columns: string, filter?: [string, unknown]) {
  let q = anon.from(table).select(columns)
  if (filter) q = q.eq(filter[0], filter[1])
  const { data, error } = await q.limit(5)
  return { error, count: data?.length ?? 0 }
}

const checks: Check[] = [
  { label: 'courses publicados', expectAllowed: true, run: () => select('courses', 'id,title,price_eur', ['is_published', true]) },
  { label: 'lessons gratuitas', expectAllowed: true, run: () => select('lessons', 'id,title', ['is_free', true]) },
  { label: 'events publicados', expectAllowed: true, run: () => select('events', 'id', ['is_published', true]) },
  { label: 'profiles columnas sociales', expectAllowed: true, run: () => select('profiles', 'id,full_name,instagram') },
  { label: 'profiles.role (DEBE seguir denegado)', expectAllowed: false, run: () => select('profiles', 'role') },
  { label: 'courses borrador (DEBE dar 0 filas)', expectAllowed: true, run: () => select('courses', 'id', ['is_published', false]) },
]

async function main() {
  let failures = 0

  for (const check of checks) {
    const { error, count } = await check.run()
    const allowed = !error

    if (allowed !== check.expectAllowed) {
      failures++
      console.log(`❌ ${check.label}`)
      console.log(`   esperado: ${check.expectAllowed ? 'permitido' : 'denegado'} · real: ${allowed ? 'permitido' : 'denegado'}`)
      if (error) console.log(`   ${error.message}`)
      continue
    }

    if (check.label.startsWith('courses borrador') && count > 0) {
      failures++
      console.log(`❌ ${check.label} — devolvió ${count} fila(s); anon no debe ver borradores`)
      continue
    }

    console.log(`✅ ${check.label}${allowed ? ` (${count} fila(s))` : ' — denegado como toca'}`)
  }

  console.log(failures === 0 ? '\n✅ Todas las comprobaciones pasan.' : `\n❌ ${failures} comprobación(es) fallan.`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
