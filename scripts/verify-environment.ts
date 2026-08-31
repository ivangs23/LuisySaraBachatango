/**
 * Dice contra qué base de datos está configurado el entorno actual, y avisa si
 * es la de producción.
 *
 * Existe porque el riesgo de este trabajo no es técnico sino de configuración:
 * si las claves se cruzan, Preview escribe en producción sin avisar de nada.
 *
 * Uso:
 *   npx tsx scripts/verify-environment.ts
 *   EXPECT=local npx tsx scripts/verify-environment.ts   # falla si no es local
 *   EXPECT=dev   npx tsx scripts/verify-environment.ts
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const PROD_REF = 'jytokoxbsykoyifzbjkd'
const DEV_REF = 'uhcjzozliqjzxviuxoxa'

type Env = 'local' | 'dev' | 'production' | 'desconocido'

function classify(url: string): Env {
  if (url.includes('127.0.0.1') || url.includes('localhost')) return 'local'
  if (url.includes(DEV_REF)) return 'dev'
  if (url.includes(PROD_REF)) return 'production'
  return 'desconocido'
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!url) {
    console.error('NEXT_PUBLIC_SUPABASE_URL no está definida')
    process.exit(1)
  }

  const env = classify(url)
  console.log(`entorno: ${env}`)
  console.log(`url:     ${url}`)

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (key) {
    const sb = createClient(url, key)
    const { count: perfiles } = await sb.from('profiles').select('*', { count: 'exact', head: true })
    const { count: compras } = await sb.from('course_purchases').select('*', { count: 'exact', head: true })
    console.log(`perfiles: ${perfiles ?? '?'} · compras: ${compras ?? '?'}`)
  }

  if (env === 'production') {
    console.log('\n⚠️  ESTÁS APUNTANDO A PRODUCCIÓN')
  }

  const expected = process.env.EXPECT
  if (expected && expected !== env) {
    console.error(`\n❌ se esperaba "${expected}" y es "${env}"`)
    process.exit(1)
  }
  if (expected) console.log(`\n✅ es "${expected}", como se esperaba`)
}

main()
