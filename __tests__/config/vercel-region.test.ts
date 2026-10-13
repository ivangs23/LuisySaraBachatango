import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * El público y la base de datos están en Europa. Con la función en us-east-1
 * cada render cruzaba el Atlántico dos veces: una por el visitante y otra por
 * cada consulta a Supabase. Se midió `x-vercel-id: cdg1::iad1::…` en 5 de 5
 * peticiones y un TTFB de 0,56-1,30 s desde Madrid por fibra.
 *
 * El proyecto de Supabase está en `eu-west-1` (Irlanda), comprobado con
 * `supabase projects list` el 2026-10-13.
 *
 * Regiones europeas de Vercel. Si algún día el proyecto de Supabase se mueve
 * fuera de Europa, este test debe cambiar a la vez que `vercel.json` — no al
 * revés.
 */
const REGIONES_EUROPEAS = ['cdg1', 'fra1', 'arn1', 'dub1', 'lhr1']

describe('vercel.json', () => {
  const config = JSON.parse(
    readFileSync(join(process.cwd(), 'vercel.json'), 'utf8'),
  ) as { regions?: string[]; crons?: unknown[] }

  it('fija una única región europea para las funciones', () => {
    expect(config.regions).toHaveLength(1)
    expect(REGIONES_EUROPEAS).toContain(config.regions?.[0])
  })

  it('no pierde el cron de purga de pendientes', () => {
    expect(config.crons).toEqual([
      { path: '/api/cron/purge-pending', schedule: '0 4 * * *' },
    ])
  })
})
