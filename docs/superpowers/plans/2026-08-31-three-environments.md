# Three Environments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el desarrollo local corra contra Docker, que `dev` y las ramas de Preview escriban en una base de datos de desarrollo en la nube, y que producción deje de recibir datos de prueba.

**Architecture:** El esquema canónico ya está versionado como migración; `supabase start` lo aplica junto a un `seed.sql` generado desde producción. Las variables de Supabase en Vercel se reapuntan para Preview y Development. Producción no se toca hasta el final, y solo cambiando valores de variables.

**Tech Stack:** Supabase CLI, Docker, Vercel CLI, Next.js 16, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-31-three-environments-design.md`

## Global Constraints

- **Producción no se toca.** Ningún paso escribe en `jytokoxbsykoyifzbjkd`. Lo único que cambia al final son valores de variables de entorno de *Preview* y *Development* en Vercel.
- **El orden importa:** local funcionando → nube dev poblada → **solo entonces** cambiar variables. Cambiarlas antes deja Preview apuntando a una base de datos vacía.
- **`COURSE_ID` está hardcodeado** (`utils/courses/landing-course.ts`, `f89a576f-4a77-40f7-93e9-23e6c820ee92`). Todo entorno necesita un curso con ese UUID o `/curso-bachatango` da 404.
- **Nunca copiar usuarios reales.** El seed lleva un admin de prueba y nada más de `auth.users`.
- **El seed se genera, no se transcribe.**
- **No pegar contraseñas ni cadenas de conexión en el repo ni en la conversación.**
- Antes de cada commit: `npm run lint && npx tsc --noEmit && npm test`. Lint en **0 errores**.
- Commit por tarea, Conventional Commits en inglés.
- Rama: `feat/three-environments` a partir de `main`. Se mergea a `main`; la rama `dev` se crea al final, en la Task 6.

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `supabase/config.toml` | Configuración del stack local (puertos, auth) |
| `scripts/generate-dev-seed.ts` | Genera `seed.sql` leyendo producción |
| `supabase/seed.sql` | Datos mínimos: curso, lecciones, landing, admin |
| `scripts/verify-environment.ts` | Contra qué base de datos está hablando la app |
| `.env.local.example` | Plantilla con las claves locales de Docker |
| `docs/DESARROLLO.md` | Cómo levantar el entorno |

Modificados: `.gitignore`, `CLAUDE.md`, `README.md`.

---

## Task 1: Inicializar el stack local

**Files:**
- Create: `supabase/config.toml` (lo genera `supabase init`)
- Modify: `.gitignore`

- [ ] **Step 1: Inicializar**

```bash
supabase init
```

Responde **no** a generar los ficheros de VS Code y de Deno: este repo no los usa.

Si avisa de que `supabase/` ya existe, es correcto — solo añade `config.toml` sin tocar los `.sql`.

- [ ] **Step 2: Ignorar los artefactos del stack local**

Añadir a `.gitignore`:

```
# Stack local de Supabase (Docker). El esquema y el seed SÍ se versionan.
supabase/.branches/
supabase/.temp/
```

`supabase/migrations/` y `supabase/seed.sql` **no** se ignoran: sin ellos nadie
puede levantar el entorno desde un clon limpio.

- [ ] **Step 3: Levantar el stack**

```bash
supabase start
```

La primera vez descarga 2-3 GB. Al terminar imprime las URLs y claves locales.

Expected: `API URL: http://127.0.0.1:54321`, `Studio URL: http://127.0.0.1:54323`, y las claves `anon` y `service_role` locales.

- [ ] **Step 4: Comprobar que la migración se aplicó**

```bash
supabase db diff --local --schema public
```
Expected: sin diferencias — la migración canónica es el estado del local.

Y contar lo que debe haber:

```bash
docker exec -i supabase_db_LuisySaraBachatango psql -U postgres -d postgres -c "
select
  (select count(*) from pg_tables where schemaname='public') as tablas,
  (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid
     join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') as policies;"
```
Expected: **22 tablas, 64 policies** — los mismos números que producción.

Si el nombre del contenedor no coincide, obtenerlo con `docker ps --format '{{.Names}}' | grep supabase_db`.

- [ ] **Step 5: Commit**

```bash
npm run lint && npx tsc --noEmit
git add supabase/config.toml .gitignore
git commit -m "chore(dev): initialise local Supabase stack

supabase start applies the canonical migration into a local Postgres, so
development stops needing any cloud database at all."
```

---

## Task 2: Generador del seed

Sembrar a mano el curso, 28 lecciones y el contenido de landing invita a erratas. Se genera leyendo producción, igual que se hizo con el seed de contenido de la landing.

**Files:**
- Create: `scripts/generate-dev-seed.ts`
- Create: `supabase/seed.sql` (salida del generador)

**Interfaces:**
- Produces: `supabase/seed.sql`, aplicado automáticamente por `supabase start` y `supabase db reset`

- [ ] **Step 1: Escribir el generador**

```ts
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
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.production.local' })
config({ path: '.env.local' })

const COURSE_ID = 'f89a576f-4a77-40f7-93e9-23e6c820ee92'

/** Contraseña del admin de prueba. Local y `dev` solo; nunca producción. */
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

  const { data: course } = await sb
    .from('courses')
    .select('id, title, description, image_url, month, year, is_published, course_type, category, price_eur')
    .eq('id', COURSE_ID)
    .single()

  if (!course) throw new Error('No se encontró el curso de la landing en origen')
  out.push('-- El UUID debe ser exactamente este: COURSE_ID está hardcodeado')
  out.push('-- en utils/courses/landing-course.ts.')
  out.push(insert('courses', [course]))

  const { data: lessons } = await sb
    .from('lessons')
    .select('id, course_id, title, description, thumbnail_url, "order", duration, is_free, mux_asset_id, mux_playback_id, mux_status, parent_lesson_id')
    .eq('course_id', COURSE_ID)
    .order('order')

  out.push('-- Los mux_playback_id son los reales: el token de Mux es el mismo')
  out.push('-- en los tres entornos, así que los vídeos se reproducen en local.')
  out.push(insert('lessons', lessons ?? []))

  for (const table of ['landing_stats', 'landing_testimonials', 'landing_faq'] as const) {
    const { data } = await sb.from(table).select('*')
    out.push(insert(table, data ?? []))
  }

  out.push(`-- Usuario admin de prueba. Contraseña: ${ADMIN_PASSWORD}`)
  out.push('-- Solo existe en local y en `dev`.')
  out.push(`insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', ${lit(ADMIN_EMAIL)},
  extensions.crypt(${lit(ADMIN_PASSWORD)}, extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Admin Dev"}'::jsonb
) on conflict (id) do nothing;`)
  out.push('')
  out.push(`-- handle_new_user crea el perfil por trigger; se fuerza el rol.
update public.profiles set role = 'admin'
 where id = '11111111-1111-1111-1111-111111111111';`)

  console.log(out.join('\n'))
}

main()
```

- [ ] **Step 2: Generar el seed**

```bash
npx tsx scripts/generate-dev-seed.ts > supabase/seed.sql
wc -l supabase/seed.sql
```

- [ ] **Step 3: Revisar la salida antes de aceptarla**

```bash
echo "curso:      $(grep -c 'insert into public.courses' supabase/seed.sql)"
echo "lecciones:  $(grep -c 'f89a576f-4a77-40f7-93e9-23e6c820ee92' supabase/seed.sql)"
echo "landing:    $(grep -c 'insert into public.landing_' supabase/seed.sql)"
echo "admin:      $(grep -c 'auth.users' supabase/seed.sql)"
echo "-- NO debe haber compras, suscripciones ni emails reales --"
grep -cE 'course_purchases|subscriptions|@gmail|@hotmail' supabase/seed.sql
```

Expected: 1 curso, el UUID repetido (curso + 28 lecciones), 3 tablas de landing,
1 bloque de `auth.users`, y **0** en la última comprobación.

- [ ] **Step 4: Aplicarlo en local**

```bash
supabase db reset
```

Reconstruye el local desde la migración y el seed. Solo toca Docker.

```bash
docker exec -i $(docker ps --format '{{.Names}}' | grep supabase_db) \
  psql -U postgres -d postgres -c "
select (select count(*) from courses) c,
       (select count(*) from lessons) l,
       (select count(*) from landing_stats) s,
       (select count(*) from profiles where role='admin') a;"
```
Expected: **1 curso, 28 lecciones, 4 cifras, 1 admin**.

- [ ] **Step 5: Commit**

```bash
npm run lint && npx tsc --noEmit
git add scripts/generate-dev-seed.ts supabase/seed.sql
git commit -m "chore(dev): generate seed for local and dev environments

The landing course must carry its exact UUID because COURSE_ID is hardcoded;
without it /curso-bachatango 404s. Mux playback IDs are the real ones, since
the Mux token is shared across environments and the videos then play locally.

Carries no real users, purchases or subscriptions."
```

---

## Task 3: Apuntar el desarrollo local a Docker

**Files:**
- Create: `.env.local.example`
- Modify: `.gitignore` (si `.env.local.example` estuviera cubierto por `.env*`)

- [ ] **Step 1: Escribir la plantilla**

Crear `.env.local.example`. Las claves de Docker son **públicas y estándar**:
iguales en toda instalación de Supabase, y por eso pueden versionarse.

```bash
# Copia este fichero a .env.local para desarrollo en local.
#
# Las claves de Supabase son las del stack local en Docker: son públicas y
# estándar, idénticas en cualquier instalación. NO son secretos.
#
# Levanta el stack con:  supabase start

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key que imprime `supabase start`>
SUPABASE_SERVICE_ROLE_KEY=<service_role key que imprime `supabase start`>

NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Mux: comparte credenciales con producción a propósito, para que los vídeos
# sembrados se reproduzcan en local. Solo lectura desde el punto de vista del
# desarrollo: no se suben assets nuevos.
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_SIGNING_KEY_ID=
MUX_SIGNING_KEY_PRIVATE=

# Stripe: no hace falta. isDemoMode() simula el cobro fuera de producción.
STRIPE_SECRET_KEY=sk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_dummy

# Opcionales. Sin ellas los emails y la analítica son no-op, que es lo deseable.
RESEND_API_KEY=
NEWSLETTER_UNSUBSCRIBE_SECRET=dev-unsubscribe-secret
LANDING_ANALYTICS_SECRET=dev-analytics-secret
```

Sustituir los dos `<...>` por lo que imprimió `supabase start` (o
`supabase status`).

- [ ] **Step 2: Comprobar que la plantilla se versiona**

```bash
git check-ignore -v .env.local.example && echo "IGNORADO — añadir excepción" || echo "se versiona"
```

Si sale ignorado (`.gitignore` tiene `.env*`), añadir la excepción:

```
!.env.local.example
```

- [ ] **Step 3: Reapuntar tu `.env.local`**

> **Aviso:** esto sustituye la clave de servicio de producción que hoy tienes en
> disco por la del stack local. Guarda una copia de seguridad antes por si
> necesitas volver: `cp .env.local .env.local.prod-backup`. Ese fichero está
> cubierto por `.gitignore`.

Copiar `.env.local.example` a `.env.local`, rellenar las claves de Mux desde la
copia de seguridad, y dejar el resto como está.

- [ ] **Step 4: Comprobar que la app funciona entera contra Docker**

```bash
npm run dev
```

En `http://localhost:3000`, sin sesión:

- La home carga con el bloque de oferta y su precio.
- `/curso-bachatango` responde 200 y muestra los 14 módulos del temario.
- `/clase-gratis` reproduce el vídeo — prueba de que Mux funciona contra local.
- `/admin` redirige a `/login`.
- Entrando con `admin@dev.local` / `devpassword123`, `/admin/landing/contenido`
  carga y deja editar.

Y que **no** se está hablando con producción:

```bash
grep -c "supabase.co" .env.local
```
Expected: **0**. Si sale distinto de 0, `.env.local` sigue apuntando a la nube.

- [ ] **Step 5: Commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add .env.local.example .gitignore
git commit -m "chore(dev): point local development at the Docker stack

.env.local held the production service role key — the one that bypasses RLS
entirely — for everyday work. It now holds the local stack's keys, which are
public and identical in every Supabase installation."
```

---

## Task 4: Comprobador de entorno

Una sola pregunta que hay que poder responder en cualquier momento: **¿contra qué base de datos estoy hablando?** Sin esto, un cruce de variables pasa desapercibido.

**Files:**
- Create: `scripts/verify-environment.ts`

**Interfaces:**
- Produces: `npx tsx scripts/verify-environment.ts` imprime el destino y falla si es producción cuando no debería serlo

- [ ] **Step 1: Escribir el script**

```ts
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

config({ path: '.env.local' })

const PROD_REF = 'jytokoxbsykoyifzbjkd'
const DEV_REF = 'uhcjzozliqjzxviuxoxa'

function classify(url: string): 'local' | 'dev' | 'production' | 'desconocido' {
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
  console.log(`url:     ${url.replace(/\/\/([^.]+)\./, '//$1.')}`)

  const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { count: users } = await sb.from('profiles').select('*', { count: 'exact', head: true })
  const { count: purchases } = await sb.from('course_purchases').select('*', { count: 'exact', head: true })
  console.log(`perfiles: ${users ?? '?'} · compras: ${purchases ?? '?'}`)

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
```

- [ ] **Step 2: Comprobar que detecta local**

```bash
EXPECT=local npx tsx scripts/verify-environment.ts
```
Expected: `entorno: local`, un número de perfiles pequeño (1, el admin sembrado),
0 compras, y `✅`.

Si dice `production`, `.env.local` no se reapuntó en la Task 3 — parar y volver.

- [ ] **Step 3: Comprobar que falla cuando debe**

```bash
EXPECT=dev npx tsx scripts/verify-environment.ts; echo "salida: $?"
```
Expected: `❌ se esperaba "dev" y es "local"`, salida **1**.

- [ ] **Step 4: Commit**

```bash
npm run lint && npx tsc --noEmit
git add scripts/verify-environment.ts
git commit -m "feat(dev): add environment verifier

The risk in this work is configuration, not code: crossed keys would have
Preview writing to production with no signal at all. This answers the one
question that matters — which database am I talking to."
```

---

## Task 5: Poblar el proyecto de desarrollo en la nube

**Files:** ninguno. Es trabajo de infraestructura.

- [ ] **Step 1: Resetear la contraseña del proyecto de desarrollo**

Supabase → **LuisYSaraBachatango-dev** → Project Settings → Database → *Reset
database password*. La contraseña se generó automáticamente al crearlo y no está
disponible.

- [ ] **Step 2: Aplicar el esquema**

```bash
supabase db push --db-url 'postgresql://postgres:TU_PASSWORD@db.uhcjzozliqjzxviuxoxa.supabase.co:5432/postgres'
```

Percent-encodear los caracteres especiales de la contraseña (`@` → `%40`,
`#` → `%23`).

> Se aplica el fichero **verbatim**. No transcribirlo a mano: una errata en una
> de las 64 policies cambiaría el control de acceso sin que ningún test lo note.

- [ ] **Step 3: Aplicar el seed**

```bash
psql '<misma cadena>' -f supabase/seed.sql
```

Si `psql` no está instalado (no lo estaba al escribir esto), usar el SQL Editor
del panel de Supabase del proyecto **dev** y pegar el contenido de
`supabase/seed.sql`.

- [ ] **Step 4: Comprobar el proyecto de desarrollo**

Desde el SQL Editor del proyecto **dev**:

```sql
select
  (select count(*) from pg_tables where schemaname='public') as tablas,
  (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid
     join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') as policies,
  (select count(*) from public.courses) as cursos,
  (select count(*) from public.lessons) as lecciones,
  (select count(*) from public.profiles where role='admin') as admins;
```

Expected: **22 tablas, 64 policies, 1 curso, 28 lecciones, 1 admin**.

Si tablas o policies no coinciden con producción, el esquema se aplicó a medias:
parar y revisar antes de tocar ninguna variable.

---

## Task 6: Reapuntar Vercel y crear la rama `dev`

El paso irreversible-en-la-práctica. **No empezarlo hasta que las Tasks 1-5 estén verificadas.**

**Files:**
- Create: `docs/DESARROLLO.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Anotar los valores actuales, por si hay que revertir**

```bash
vercel env ls | grep -E "SUPABASE"
```

La reversión consiste en volver a poner los valores de producción en Preview y
Development. Anotar que hoy los tres entornos comparten valor.

- [ ] **Step 2: Sustituir las variables de Preview y Development**

Para cada una de `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY`:

```bash
vercel env rm  <NOMBRE> preview      --yes
vercel env rm  <NOMBRE> development  --yes
vercel env add <NOMBRE> preview
vercel env add <NOMBRE> development
```

Los valores nuevos salen del panel del proyecto **dev**: Project Settings → API.

> **Aviso:** el peligro está aquí. Pegar por error la clave de servicio de
> producción dejaría Preview escribiendo en la base de datos real, con la falsa
> sensación de estar resuelto. El Step 5 lo comprueba.

**Producción no se toca.** Solo `preview` y `development`.

- [ ] **Step 3: Crear la rama `dev`**

```bash
git checkout main && git pull
git checkout -b dev
git push -u origin dev
```

- [ ] **Step 4: Esperar al despliegue de `dev` y comprobar que funciona**

En el panel de Vercel, esperar al despliegue de la rama `dev` y abrir su URL:

- La home carga con el bloque de oferta.
- `/curso-bachatango` responde 200 con los 14 módulos.
- `/clase-gratis` reproduce.

Si `/curso-bachatango` da 404, el curso no se sembró con su UUID exacto en el
proyecto dev — volver a la Task 5.

- [ ] **Step 5: Comprobar que `dev` escribe en desarrollo y NO en producción**

La comprobación que justifica todo el trabajo. Desde el despliegue de `dev`,
suscribirse a la newsletter con una dirección marcada:

```
prueba-entornos-<fecha>@dev.local
```

Y comprobar dónde aterrizó, en los dos proyectos:

```sql
-- En el SQL Editor de dev: DEBE aparecer
select email from newsletter_subscribers where email like 'prueba-entornos-%';

-- En el SQL Editor de producción: NO debe aparecer
select email from newsletter_subscribers where email like 'prueba-entornos-%';
```

Expected: **1 fila en dev, 0 en producción.**

Si aparece en producción, las variables se cruzaron: volver al Step 2 antes de
seguir. Borrar después la fila de prueba en dev.

- [ ] **Step 6: Documentar**

Crear `docs/DESARROLLO.md`:

```markdown
# Entornos

| Entorno | Base de datos | Cuándo |
|---|---|---|
| local | Docker (`supabase start`) | trabajo diario |
| `dev` y ramas de Preview | proyecto dev en la nube | revisar una PR desplegada |
| producción (`main`) | proyecto de producción | solo lo ya probado |

## Levantar el entorno local

```bash
supabase start                 # Postgres, Auth y Storage en Docker
cp .env.local.example .env.local
# rellenar las claves de Mux desde el panel de Mux
npm run dev
```

`supabase start` aplica sola la migración canónica y `supabase/seed.sql`, así que
el local trae el curso de la landing, sus 28 lecciones y un admin de prueba
(`admin@dev.local` / `devpassword123`).

Para empezar de cero: `supabase db reset`.

## Contra qué base de datos estoy hablando

```bash
npx tsx scripts/verify-environment.ts
```

## Flujo de trabajo

`feature → dev → main`. Los hotfixes pueden ir directos a `main` y luego
retro-mergearse a `dev`.

## Qué NO está en Docker

Mux, Resend y Stripe siguen siendo servicios en la nube. Los vídeos se ven en
local porque el token de Mux se comparte; el cobro está simulado por
`isDemoMode()`; y sin `RESEND_API_KEY` los emails son no-op.
```

Y en `CLAUDE.md`, junto al bloque de variables de entorno, una nota apuntando a
`docs/DESARROLLO.md` y avisando de que el desarrollo local va contra Docker.

- [ ] **Step 7: Commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add docs/DESARROLLO.md CLAUDE.md
git commit -m "docs: document the three environments and the local Docker setup"
```

---

## Verificación final

- [ ] `npm run lint && npx tsc --noEmit && npm test && npm run build` — todo verde
- [ ] `EXPECT=local npx tsx scripts/verify-environment.ts` — pasa
- [ ] `supabase db reset` reconstruye el local con curso, 28 lecciones y admin
- [ ] La app funciona entera contra Docker, incluido el vídeo de `/clase-gratis`
- [ ] `grep -c "supabase.co" .env.local` devuelve **0**
- [ ] El proyecto dev tiene 22 tablas y 64 policies, como producción
- [ ] El despliegue de `dev` responde 200 en `/curso-bachatango` con los 14 módulos
- [ ] La suscripción de prueba desde `dev` aparece en dev y **no** en producción
- [ ] Producción sigue con sus variables originales sin tocar

## Auto-revisión del plan

**Cobertura del spec:** Docker local → Tasks 1-3 · seed con el UUID exacto →
Task 2 · `.env.local` sin credencial de producción → Task 3 · comprobación
anti-cruce → Tasks 4 y 6 · nube dev → Task 5 · rama `dev` y variables → Task 6 ·
documentación → Task 6.

**Consistencia:** `COURSE_ID` (`f89a576f-…`) aparece igual en el generador de la
Task 2 y en las comprobaciones de las Tasks 5 y 6. Los refs de proyecto
(`jytokoxbsykoyifzbjkd` producción, `uhcjzozliqjzxviuxoxa` dev) coinciden entre
`scripts/verify-environment.ts` y la Task 5.

**Orden obligatorio:** Task 1 antes que la 2 (sin stack no hay dónde aplicar el
seed). Task 2 antes que la 3. Task 3 antes que la 4 (el comprobador se prueba
contra local). Tasks 1-5 **todas** antes que la 6: cambiar las variables antes de
poblar la nube dejaría Preview apuntando a una base de datos vacía.
