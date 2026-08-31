/**
 * Comprueba, como un visitante anónimo cualquiera, que la superficie pública
 * de producción sigue en pie.
 *
 * Existe por un incidente concreto: `2026_07_fix2_security_hardening.sql`
 * revocó a `anon` el SELECT sobre `profiles.role` y dejó policies RLS que
 * seguían leyéndolo. `/curso-bachatango` devolvió **404 a todo visitante
 * deslogueado** durante semanas y nadie se dio cuenta, porque nada vigilaba
 * la web sin sesión. Ver supabase/MIGRATIONS.md.
 *
 * No necesita credenciales: solo HTTP contra el dominio público. Por eso puede
 * correr en CI programado sin exponer nada.
 *
 * Uso:
 *   npx tsx scripts/check-public-surface.ts
 *   BASE_URL=https://preview-xyz.vercel.app npx tsx scripts/check-public-surface.ts
 */

const BASE = (process.env.BASE_URL ?? 'https://luisysarabachatango.com').replace(/\/$/, '')

interface Check {
  path: string
  /** Fragmentos que DEBEN aparecer en el HTML. */
  expect?: string[]
  /** Fragmentos que NO deben aparecer. */
  reject?: string[]
  why: string
}

const CHECKS: Check[] = [
  {
    path: '/',
    expect: ['/curso-bachatango'],
    why: 'la home debe enlazar el funnel de venta',
  },
  {
    path: '/curso-bachatango',
    why: 'el funnel devolvió 404 a anónimos durante semanas por una policy RLS',
  },
  {
    path: '/clase-gratis',
    expect: ['mux-player'],
    reject: ['no está disponible'],
    why: 'la clase gratis debe servir el reproductor sin sesión',
  },
  {
    path: '/courses',
    reject: ['No hay cursos publicados'],
    why: 'el listado vacío para anónimos es el síntoma de que la RLS volvió a romperse',
  },
  { path: '/events', why: 'events también depende de la policy que se rompió' },
  { path: '/sitemap.xml', expect: ['/curso-bachatango', '/clase-gratis'], why: 'las rutas de venta deben ser indexables' },
  { path: '/robots.txt', why: 'robots debe responder' },
  { path: '/opengraph-image', why: 'los previews de enlace dependen de esta ruta' },
]

async function run(): Promise<number> {
  let failures = 0

  for (const c of CHECKS) {
    const url = `${BASE}${c.path}`
    let status = 0
    let body = ''

    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'public-surface-monitor' } })
      status = res.status
      // Solo se lee el cuerpo si hay algo que buscar dentro.
      if (c.expect?.length || c.reject?.length) body = await res.text()
    } catch (e) {
      console.log(`❌ ${c.path} — la petición falló: ${(e as Error).message}`)
      console.log(`   ${c.why}`)
      failures++
      continue
    }

    if (status !== 200) {
      console.log(`❌ ${c.path} — HTTP ${status}`)
      console.log(`   ${c.why}`)
      failures++
      continue
    }

    const missing = (c.expect ?? []).filter((s) => !body.includes(s))
    const present = (c.reject ?? []).filter((s) => body.includes(s))

    if (missing.length || present.length) {
      console.log(`❌ ${c.path} — HTTP 200 pero el contenido no cuadra`)
      if (missing.length) console.log(`   falta: ${missing.join(', ')}`)
      if (present.length) console.log(`   no debería estar: ${present.join(', ')}`)
      console.log(`   ${c.why}`)
      failures++
      continue
    }

    console.log(`✅ ${c.path}`)
  }

  console.log(
    failures === 0
      ? `\n✅ Superficie pública correcta en ${BASE}`
      : `\n❌ ${failures} comprobación(es) fallan en ${BASE}`,
  )
  return failures
}

run().then((f) => process.exit(f === 0 ? 0 : 1))
