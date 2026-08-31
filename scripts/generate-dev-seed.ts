/**
 * Genera `supabase/seed.sql` leyendo producción: el curso de la landing, sus
 * lecciones y el contenido editable. Más un usuario admin de prueba.
 *
 * Se genera en vez de transcribirse: son 28 lecciones y 10 filas de contenido
 * localizado, y copiarlas a mano invita a erratas silenciosas.
 *
 * NUNCA copia usuarios, compras ni suscripciones reales.
 *
 * Uso:  npx tsx scripts/generate-dev-seed.ts > supabase/seed.sql
 *
 * Debe ejecutarse con `.env.local` apuntando a PRODUCCIÓN (o pasando las
 * variables a mano). Si apunta a local, no habrá datos que copiar.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const COURSE_ID = 'f89a576f-4a77-40f7-93e9-23e6c820ee92'

/** Admin de prueba. Solo local y `dev`; nunca producción. */
const ADMIN_ID = '11111111-1111-1111-1111-111111111111'
const ADMIN_EMAIL = 'admin@dev.local'
const ADMIN_PASSWORD = 'devpassword123'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function lit(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}

function insert(table: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return `-- ${table}: sin filas\n`
  const cols = Object.keys(rows[0])
  const values = rows
    .map((r) => '  (' + cols.map((c) => lit(r[c])).join(', ') + ')')
    .join(',\n')
  return `insert into public.${table} (${cols.map((c) => `"${c}"`).join(', ')}) values\n${values}\non conflict do nothing;\n`
}

async function main() {
  const out: string[] = []
  out.push('-- Seed generado por scripts/generate-dev-seed.ts. No editar a mano.')
  out.push('-- Solo para local y `dev`. NUNCA se aplica a producción.')
  out.push('-- No contiene usuarios, compras ni suscripciones reales.')
  out.push('')

  const { data: course, error: courseErr } = await sb
    .from('courses')
    .select('id, title, description, image_url, month, year, is_published, course_type, category, price_eur')
    .eq('id', COURSE_ID)
    .single()

  if (courseErr || !course) {
    console.error('No se encontró el curso de la landing en origen:', courseErr?.message)
    process.exit(1)
  }

  out.push('-- El UUID debe ser exactamente este: COURSE_ID está hardcodeado')
  out.push('-- en utils/courses/landing-course.ts. Sin esta fila, /curso-bachatango da 404.')
  out.push(insert('courses', [course as Record<string, unknown>]))

  const { data: lessons } = await sb
    .from('lessons')
    .select('id, course_id, title, description, thumbnail_url, "order", duration, is_free, mux_asset_id, mux_playback_id, mux_status, parent_lesson_id')
    .eq('course_id', COURSE_ID)
    .order('order')

  out.push('-- Los mux_playback_id son los reales: el token de Mux es el mismo')
  out.push('-- en los tres entornos, así que los vídeos se reproducen en local.')
  out.push(insert('lessons', (lessons ?? []) as Record<string, unknown>[]))

  for (const table of ['landing_stats', 'landing_testimonials', 'landing_faq'] as const) {
    const { data } = await sb.from(table).select('*')
    out.push(insert(table, (data ?? []) as Record<string, unknown>[]))
  }

  out.push(`-- Usuario admin de prueba. Contraseña: ${ADMIN_PASSWORD}`)
  out.push('-- Solo existe en local y en `dev`.')
  out.push(`insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  ${lit(ADMIN_ID)},
  'authenticated', 'authenticated', ${lit(ADMIN_EMAIL)},
  extensions.crypt(${lit(ADMIN_PASSWORD)}, extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Admin Dev"}'::jsonb
) on conflict (id) do nothing;`)
  out.push('')
  out.push(`-- handle_new_user crea el perfil por trigger; se fuerza el rol.
update public.profiles set role = 'admin' where id = ${lit(ADMIN_ID)};`)

  console.log(out.join('\n'))
}

main()
