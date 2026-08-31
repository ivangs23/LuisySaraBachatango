/**
 * Rellena `lessons.duration` (segundos) preguntando a Mux la duración de cada
 * asset. Idempotente: solo toca filas con `duration IS NULL`, así que puede
 * reejecutarse tras subir vídeos nuevos.
 *
 * Uso:
 *   npx tsx scripts/backfill-lesson-durations.ts          # simulacro
 *   npx tsx scripts/backfill-lesson-durations.ts --write  # escribe de verdad
 */
import { config } from 'dotenv'
import Mux from '@mux/mux-node'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const WRITE = process.argv.includes('--write')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
})

async function main() {
  const { data: lessons, error } = await supabase
    .from('lessons')
    .select('id, title, mux_asset_id, duration')
    .not('mux_asset_id', 'is', null)
    .is('duration', null)

  if (error) {
    console.error('No se pudieron leer las lecciones:', error.message)
    process.exit(1)
  }
  if (!lessons?.length) {
    console.log('Nada que hacer: todas las lecciones con asset ya tienen duración.')
    return
  }

  console.log(`${lessons.length} lección(es) sin duración.${WRITE ? '' : ' SIMULACRO — usa --write para escribir.'}\n`)

  let ok = 0
  let failed = 0

  for (const lesson of lessons) {
    try {
      const asset = await mux.video.assets.retrieve(lesson.mux_asset_id!)
      if (typeof asset.duration !== 'number') {
        console.log(`⚠  ${lesson.title.slice(0, 40)} — Mux no devuelve duración todavía`)
        failed++
        continue
      }
      const seconds = Math.round(asset.duration)
      const mins = Math.floor(seconds / 60)
      console.log(`   ${lesson.title.slice(0, 40).padEnd(40)} ${mins}m ${seconds % 60}s`)

      if (WRITE) {
        const { error: upErr } = await supabase
          .from('lessons')
          .update({ duration: seconds })
          .eq('id', lesson.id)
        if (upErr) {
          console.log(`❌ no se pudo guardar: ${upErr.message}`)
          failed++
          continue
        }
      }
      ok++
    } catch (e) {
      console.log(`❌ ${lesson.title.slice(0, 40)} — ${(e as Error).message}`)
      failed++
    }
  }

  console.log(`\n${WRITE ? 'Escritas' : 'Se escribirían'}: ${ok} · fallos: ${failed}`)
  if (failed > 0) process.exit(1)
}

main()
