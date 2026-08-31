# Landing Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medir el embudo de venta con eventos propios y sin cookies, y enseñarlo en `/admin/landing`.

**Architecture:** Un beacon de cliente manda la ruta visitada a una API propia; esa ruta calcula un hash diario del visitante a partir de la IP —que nunca se guarda— e inserta una fila en `landing_events`. El panel agrega esas filas en dos vistas: embudo con porcentaje de caída y serie diaria de vistas y únicos.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, CSS Modules, Supabase (PostgreSQL + RLS), Recharts, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-13-landing-analytics-design.md`

## Global Constraints

- **No se guarda nunca IP, user-agent, `user_id` ni cookie.** Solo el hash derivado. Si esto cambia, la funcionalidad pasa a requerir consentimiento y hay que subir `CONSENT_VERSION`.
- **Fuera del banner de consentimiento**, a propósito. No se envuelve en `useConsent()` ni se monta dentro de `ConsentProvider` como dependencia.
- **Fail-closed:** sin `LANDING_ANALYTICS_SECRET` no se guarda nada y la ruta responde 204.
- **La analítica nunca rompe la navegación.** La ruta de API responde 204 pase lo que pase.
- **El `path` del cliente es entrada no confiable** y se valida contra allowlist cerrada. Nunca se inserta lo que mande el navegador.
- Sin Tailwind ni Shadcn. CSS Modules.
- Tests en `__tests__/`; los de componente llevan `// @vitest-environment jsdom` en la primera línea; los módulos con `import 'server-only'` necesitan `vi.mock('server-only', () => ({}))`.
- Antes de cada commit: `npm run lint && npx tsc --noEmit && npm test`. Lint en **0 errores** (los 18 warnings son deuda previa).
- Commit por tarea, Conventional Commits en inglés.
- Rama: `feat/landing-analytics` a partir de `main`.

## Estructura de ficheros

| Fichero | Responsabilidad |
|---|---|
| `supabase/2026_08_landing_events.sql` | Tabla, índices, RLS |
| `utils/analytics/tracked-paths.ts` | Allowlist y pasos del embudo — única declaración de rutas |
| `utils/analytics/visitor-hash.ts` | Hash diario y detección de bots |
| `app/api/landing-event/route.ts` | Valida, limita, hashea, inserta |
| `components/LandingAnalytics.tsx` | Beacon al cambiar de ruta |
| `utils/admin/landing-queries.ts` | `getLandingFunnel`, `getLandingTraffic` |
| `components/admin/charts/LandingFunnelChart.tsx` | Embudo |
| `components/admin/charts/LandingTrafficChart.tsx` | Serie diaria |
| `app/admin/landing/page.tsx` + `landing.module.css` | Página |

Modificados: `utils/admin/queries.ts` (exportar `rangeStartIso`), `components/admin/AdminSidebar.tsx`, `app/layout.tsx`, `CLAUDE.md`, `vitest.setup.ts`.

---

## Task 1: Tabla `landing_events`

**Files:**
- Create: `supabase/2026_08_landing_events.sql`
- Modify: `supabase/MIGRATIONS.md`

- [ ] **Step 1: Escribir la migración**

```sql
-- ============================================================================
-- Eventos de la landing: vistas de página sin cookies ni datos personales.
--
-- Por qué no GA4: está detrás del banner de consentimiento, así que solo cuenta
-- a quien acepta (50-70% del tráfico), y no puede cruzarse con course_purchases.
--
-- Qué se guarda: la ruta, un hash de visitante que caduca cada día, y la fecha.
-- Qué NO se guarda: IP, user-agent, user_id, cookie. El hash se calcula en
-- servidor con una sal que cambia a diario y las entradas se descartan.
--
-- Idempotente.
-- ============================================================================

create table if not exists public.landing_events (
  id           bigserial   primary key,
  path         text        not null,
  visitor_hash text        not null,
  created_at   timestamptz not null default now()
);

create index if not exists landing_events_created_at_idx
  on public.landing_events (created_at desc);

create index if not exists landing_events_path_created_idx
  on public.landing_events (path, created_at desc);

alter table public.landing_events enable row level security;

-- Solo admin lee. `public.is_admin()` es SECURITY DEFINER (2026_08_fix_anon_read_admin_check.sql):
-- comprobar el rol leyendo profiles.role directamente es el patrón que tumbó el
-- embudo en julio.
drop policy if exists "landing_events admin SELECT" on public.landing_events;
create policy "landing_events admin SELECT" on public.landing_events
  for select using (public.is_admin());

-- Nadie inserta con la anon key: las escrituras van con service role desde
-- /api/landing-event, que es quien valida la ruta y calcula el hash.
drop policy if exists "landing_events no client INSERT" on public.landing_events;
create policy "landing_events no client INSERT" on public.landing_events
  for insert with check (false);

-- ============================================================================
-- VALIDACIÓN — ejecutar después:
--
--   Con la anon key:  select * from landing_events            → 0 filas o denegado
--   Con la anon key:  insert into landing_events(...)         → debe fallar
--   Con sesión admin: select count(*) from landing_events     → funciona
-- ============================================================================
```

- [ ] **Step 2: Aplicarla**

> Crea una tabla nueva. No toca datos existentes.

Supabase → SQL Editor → pegar → Run.

- [ ] **Step 3: Verificar que la anon key no puede leer ni escribir**

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const {createClient}=require('@supabase/supabase-js');
const anon=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async()=>{
  const r=await anon.from('landing_events').select('id').limit(1);
  console.log('SELECT anon ->', r.error ? 'denegado: '+r.error.message : r.data.length+' filas');
  const w=await anon.from('landing_events').insert({path:'/x',visitor_hash:'y'});
  console.log('INSERT anon ->', w.error ? 'denegado: '+w.error.message : 'ESCRIBIÓ — MAL');
})();
" 2>&1 | grep -v injected
```
Expected: SELECT 0 filas o denegado; INSERT **denegado**. Si el INSERT pasa, parar y revisar la policy.

- [ ] **Step 4: Registrar y commit**

Añadir la fila a la tabla de agosto de `supabase/MIGRATIONS.md`.

```bash
git add supabase/2026_08_landing_events.sql supabase/MIGRATIONS.md
git commit -m "feat(analytics): add landing_events table

Cookieless page-view events for funnel measurement. Admin-only reads, no
client writes: inserts go through the API route that validates the path."
```

---

## Task 2: Allowlist de rutas y definición del embudo

Único sitio donde se declaran las rutas medidas. La API valida contra esto y el panel construye el embudo desde aquí, así que no pueden desincronizarse.

**Files:**
- Create: `utils/analytics/tracked-paths.ts`
- Test: `__tests__/utils/tracked-paths.test.ts`

**Interfaces:**
- Produces:
  - `export const TRACKED_PATHS: readonly string[]`
  - `export type TrackedPath = typeof TRACKED_PATHS[number]`
  - `export function normalisePath(raw: unknown): TrackedPath | null`
  - `export const FUNNEL_STEPS: readonly { path: TrackedPath; label: string }[]`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from 'vitest'
import { normalisePath, TRACKED_PATHS, FUNNEL_STEPS } from '@/utils/analytics/tracked-paths'

describe('normalisePath', () => {
  it('acepta las rutas medidas', () => {
    for (const p of TRACKED_PATHS) expect(normalisePath(p)).toBe(p)
  })

  it('quita query string y hash', () => {
    expect(normalisePath('/curso-bachatango?utm_source=ig')).toBe('/curso-bachatango')
    expect(normalisePath('/curso-bachatango#oferta')).toBe('/curso-bachatango')
    expect(normalisePath('/gracias?session_id=cs_123')).toBe('/gracias')
  })

  it('quita la barra final salvo en la raíz', () => {
    expect(normalisePath('/curso-bachatango/')).toBe('/curso-bachatango')
    expect(normalisePath('/')).toBe('/')
  })

  it('rechaza rutas no declaradas', () => {
    expect(normalisePath('/admin')).toBeNull()
    expect(normalisePath('/courses/abc')).toBeNull()
    expect(normalisePath('/curso-bachatango/comprar/extra')).toBeNull()
  })

  it('rechaza entradas que no son cadenas', () => {
    expect(normalisePath(null)).toBeNull()
    expect(normalisePath(undefined)).toBeNull()
    expect(normalisePath(42)).toBeNull()
    expect(normalisePath({ path: '/' })).toBeNull()
  })

  it('rechaza intentos de colar otra cosa', () => {
    expect(normalisePath('https://evil.com/')).toBeNull()
    expect(normalisePath('//evil.com')).toBeNull()
    expect(normalisePath("/'; drop table landing_events; --")).toBeNull()
    expect(normalisePath('/'.repeat(5000))).toBeNull()
  })

  it('el embudo solo usa rutas medidas y está ordenado', () => {
    expect(FUNNEL_STEPS.length).toBe(4)
    for (const s of FUNNEL_STEPS) expect(TRACKED_PATHS).toContain(s.path)
    expect(FUNNEL_STEPS.map(s => s.path)).toEqual([
      '/', '/curso-bachatango', '/curso-bachatango/comprar', '/gracias',
    ])
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run __tests__/utils/tracked-paths.test.ts`
Expected: FAIL — `Cannot find package '@/utils/analytics/tracked-paths'`

- [ ] **Step 3: Escribir el módulo**

```ts
/**
 * Rutas que se miden y pasos del embudo.
 *
 * Es la única declaración: la API valida contra `TRACKED_PATHS` y el panel
 * construye el embudo desde `FUNNEL_STEPS`, así que no pueden desincronizarse.
 *
 * Sin `import 'server-only'` a propósito: `components/LandingAnalytics.tsx` lo
 * usa en cliente para no mandar beacons de rutas que se van a descartar.
 */
export const TRACKED_PATHS = [
  '/',
  '/curso-bachatango',
  '/clase-gratis',
  '/curso-bachatango/comprar',
  '/gracias',
] as const

export type TrackedPath = (typeof TRACKED_PATHS)[number]

/** Cota defensiva: una ruta real nunca se acerca, y evita trabajo inútil. */
const MAX_PATH_LENGTH = 512

/**
 * Devuelve la ruta medida correspondiente, o null si no lo es.
 *
 * El valor viene del navegador, así que se trata como no confiable: se
 * normaliza y se comprueba contra la allowlist. Lo que no esté en la lista no
 * llega nunca a la base de datos.
 */
export function normalisePath(raw: unknown): TrackedPath | null {
  if (typeof raw !== 'string') return null
  if (raw.length === 0 || raw.length > MAX_PATH_LENGTH) return null

  // Solo rutas absolutas de este sitio: '//evil.com' es una URL protocol-relative.
  if (!raw.startsWith('/') || raw.startsWith('//')) return null

  const withoutHash = raw.split('#')[0]
  const withoutQuery = withoutHash.split('?')[0]
  const trimmed =
    withoutQuery.length > 1 && withoutQuery.endsWith('/')
      ? withoutQuery.slice(0, -1)
      : withoutQuery

  return (TRACKED_PATHS as readonly string[]).includes(trimmed)
    ? (trimmed as TrackedPath)
    : null
}

/**
 * Pasos del embudo, en orden. `/clase-gratis` se mide pero no es un paso: es
 * una entrada lateral, no un punto por el que todos pasen.
 */
export const FUNNEL_STEPS = [
  { path: '/', label: 'Inicio' },
  { path: '/curso-bachatango', label: 'Página de venta' },
  { path: '/curso-bachatango/comprar', label: 'Formulario de compra' },
  { path: '/gracias', label: 'Compra completada' },
] as const satisfies readonly { path: TrackedPath; label: string }[]
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run __tests__/utils/tracked-paths.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add utils/analytics/tracked-paths.ts __tests__/utils/tracked-paths.test.ts
git commit -m "feat(analytics): add tracked path allowlist and funnel definition

Single source for both the API validation and the admin funnel, so they
cannot drift apart. Path arrives from the browser and is untrusted."
```

---

## Task 3: Hash diario del visitante

**Files:**
- Create: `utils/analytics/visitor-hash.ts`
- Test: `__tests__/utils/visitor-hash.test.ts`
- Modify: `vitest.setup.ts`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces:
  - `export function dailyVisitorHash(ip: string, userAgent: string | null, now: Date): string | null`
  - `export function isBot(userAgent: string | null): boolean`

- [ ] **Step 1: Añadir el secreto al setup de tests**

En `vitest.setup.ts`, junto a las demás variables:

```ts
process.env.LANDING_ANALYTICS_SECRET = 'test-landing-analytics-secret'
```

- [ ] **Step 2: Escribir el test que falla**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// server-only throws outside of Next.js server context — mock it for test env.
vi.mock('server-only', () => ({}))

import { dailyVisitorHash, isBot } from '@/utils/analytics/visitor-hash'

const OLD = process.env.LANDING_ANALYTICS_SECRET
const DAY_1 = new Date('2026-08-13T10:00:00Z')
const DAY_1_LATE = new Date('2026-08-13T23:59:00Z')
const DAY_2 = new Date('2026-08-14T00:01:00Z')

describe('dailyVisitorHash', () => {
  beforeEach(() => { process.env.LANDING_ANALYTICS_SECRET = 'test-secret' })
  afterEach(() => { process.env.LANDING_ANALYTICS_SECRET = OLD })

  it('es estable dentro del mismo día', () => {
    const a = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)
    const b = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1_LATE)
    expect(a).toBe(b)
  })

  it('cambia al día siguiente: no hay seguimiento entre días', () => {
    const a = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)
    const b = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_2)
    expect(a).not.toBe(b)
  })

  it('distingue visitantes distintos', () => {
    const a = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)
    const b = dailyVisitorHash('5.6.7.8', 'Mozilla/5.0', DAY_1)
    const c = dailyVisitorHash('1.2.3.4', 'Otro/1.0', DAY_1)
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it('no filtra la IP ni el user-agent en la salida', () => {
    const h = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)!
    expect(h).not.toContain('1.2.3.4')
    expect(h).not.toContain('Mozilla')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('fail-closed sin secreto configurado', () => {
    delete process.env.LANDING_ANALYTICS_SECRET
    expect(dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)).toBeNull()
  })

  it('cambiar el secreto cambia los hashes', () => {
    const a = dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)
    process.env.LANDING_ANALYTICS_SECRET = 'otro'
    expect(dailyVisitorHash('1.2.3.4', 'Mozilla/5.0', DAY_1)).not.toBe(a)
  })
})

describe('isBot', () => {
  it('detecta rastreadores habituales', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0)',
      'facebookexternalhit/1.1',
      'curl/8.4.0',
      'python-requests/2.31.0',
      'Chrome-Lighthouse',
      'public-surface-monitor',
    ]) expect(isBot(ua), ua).toBe(true)
  })

  it('deja pasar navegadores reales', () => {
    expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36')).toBe(false)
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(false)
  })

  it('trata la ausencia de user-agent como bot', () => {
    expect(isBot(null)).toBe(true)
    expect(isBot('')).toBe(true)
  })
})
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npx vitest run __tests__/utils/visitor-hash.test.ts`
Expected: FAIL — `Cannot find package '@/utils/analytics/visitor-hash'`

- [ ] **Step 4: Escribir el módulo**

```ts
import 'server-only'
import { createHash, createHmac } from 'node:crypto'

/**
 * Identificador efímero de visitante, sin cookie y sin datos personales.
 *
 *   sal_del_día  = hmac_sha256(LANDING_ANALYTICS_SECRET, 'YYYY-MM-DD')
 *   visitor_hash = sha256(sal_del_día || ip || user_agent)
 *
 * La IP y el user-agent entran en el cálculo y se descartan: nunca se guardan.
 * La sal cambia a medianoche UTC, así que el mismo visitante recibe otro hash
 * mañana — no hay seguimiento entre días, por diseño.
 *
 * Riesgo residual asumido: quien tuviera el secreto Y una IP concreta podría
 * recalcular el hash de ese día y comprobar si esa IP estuvo. Exige las dos
 * cosas y solo funciona dentro del mismo día. La alternativa (sal aleatoria
 * rotada y destruida) pide tabla y tarea de rotación, y no compensa a esta
 * escala. Ver el spec.
 *
 * Fail-closed: sin secreto devuelve null y no se mide nada.
 */
export function dailyVisitorHash(
  ip: string,
  userAgent: string | null,
  now: Date,
): string | null {
  const secret = process.env.LANDING_ANALYTICS_SECRET
  if (!secret) return null

  const day = now.toISOString().slice(0, 10) // YYYY-MM-DD en UTC
  const dailySalt = createHmac('sha256', secret).update(day).digest('hex')

  return createHash('sha256')
    .update(`${dailySalt}|${ip}|${userAgent ?? ''}`)
    .digest('hex')
}

/**
 * Rastreadores y herramientas. Sin esto los números mienten: el monitor de
 * superficie pública pasa cada 6 h y Lighthouse cada vez que se mide.
 *
 * Sin user-agent se considera bot: un navegador real siempre manda uno.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|curl|wget|python-requests|axios|node-fetch|headless|lighthouse|pingdom|monitor|preview|facebookexternalhit|whatsapp|telegram|embedly|quora|pinterest|vercel|gtmetrix|phantomjs|puppeteer|playwright/i

export function isBot(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true
  return BOT_PATTERN.test(userAgent)
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npx vitest run __tests__/utils/visitor-hash.test.ts`
Expected: PASS, 9 tests

- [ ] **Step 6: Documentar la variable**

En `CLAUDE.md`, en el bloque de variables de entorno:

```
LANDING_ANALYTICS_SECRET       # HMAC key for the daily visitor-hash salt used by /api/landing-event. Fail-closed: if unset, no landing events are recorded and the route still returns 204. Rotating it breaks unique-visitor continuity for that day.
```

Generar el valor y darlo de alta:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
vercel env add LANDING_ANALYTICS_SECRET production
```

- [ ] **Step 7: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add utils/analytics/visitor-hash.ts __tests__/utils/visitor-hash.test.ts vitest.setup.ts CLAUDE.md
git commit -m "feat(analytics): add cookieless daily visitor hash

IP and user-agent feed the hash and are discarded — never stored. The salt
rotates at UTC midnight, so there is no cross-day tracking by design."
```

---

## Task 4: Ruta de API `/api/landing-event`

**Files:**
- Create: `app/api/landing-event/route.ts`
- Test: `__tests__/api/landing-event.test.ts`

**Interfaces:**
- Consumes: `normalisePath` (Task 2), `dailyVisitorHash`, `isBot` (Task 3), `rateLimit`/`rateLimitKey` de `@/utils/rate-limit`, `getClientIp` de `@/utils/auth/client-ip`
- Produces: `POST /api/landing-event`, cuerpo `{ path: string }`, responde **204 siempre**

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const insertMock = vi.fn()
vi.mock('@/utils/supabase/admin', () => ({
  createSupabaseAdmin: () => ({ from: () => ({ insert: insertMock }) }),
}))

vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
}))

vi.mock('@/utils/auth/client-ip', () => ({ getClientIp: () => '1.2.3.4' }))

import { POST } from '@/app/api/landing-event/route'

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

function req(body: unknown, ua: string = BROWSER_UA): Request {
  return new Request('http://localhost/api/landing-event', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': ua },
    body: JSON.stringify(body),
  })
}

describe('POST /api/landing-event', () => {
  beforeEach(() => {
    insertMock.mockReset().mockResolvedValue({ error: null })
    process.env.LANDING_ANALYTICS_SECRET = 'test-secret'
  })

  it('guarda una ruta medida y responde 204', async () => {
    const res = await POST(req({ path: '/curso-bachatango' }))
    expect(res.status).toBe(204)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/curso-bachatango', visitor_hash: expect.any(String) }),
    )
  })

  it('normaliza la ruta antes de guardarla', async () => {
    await POST(req({ path: '/curso-bachatango?utm_source=ig' }))
    expect(insertMock.mock.calls[0][0].path).toBe('/curso-bachatango')
  })

  it('nunca guarda la IP ni el user-agent', async () => {
    await POST(req({ path: '/' }))
    const row = JSON.stringify(insertMock.mock.calls[0][0])
    expect(row).not.toContain('1.2.3.4')
    expect(row).not.toContain('Mozilla')
  })

  it('descarta rutas no permitidas sin tocar la BD', async () => {
    const res = await POST(req({ path: '/admin' }))
    expect(res.status).toBe(204)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('descarta cuerpos malformados', async () => {
    for (const body of [{}, { path: 42 }, { otra: 'cosa' }]) {
      await POST(req(body))
    }
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('descarta JSON inválido sin lanzar', async () => {
    const bad = new Request('http://localhost/api/landing-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': BROWSER_UA },
      body: 'no-es-json',
    })
    const res = await POST(bad)
    expect(res.status).toBe(204)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('descarta bots', async () => {
    const res = await POST(req({ path: '/' }, 'Mozilla/5.0 (compatible; Googlebot/2.1)'))
    expect(res.status).toBe(204)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('fail-closed sin secreto', async () => {
    delete process.env.LANDING_ANALYTICS_SECRET
    const res = await POST(req({ path: '/' }))
    expect(res.status).toBe(204)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('respeta el limitador', async () => {
    const { rateLimit } = await import('@/utils/rate-limit')
    vi.mocked(rateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 60 })
    const res = await POST(req({ path: '/' }))
    expect(res.status).toBe(204)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('responde 204 aunque la BD falle: la analítica no rompe la navegación', async () => {
    insertMock.mockResolvedValue({ error: { message: 'boom' } })
    const res = await POST(req({ path: '/' }))
    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run __tests__/api/landing-event.test.ts`
Expected: FAIL — no existe el módulo de la ruta

- [ ] **Step 3: Escribir la ruta**

```ts
import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'
import { normalisePath } from '@/utils/analytics/tracked-paths'
import { dailyVisitorHash, isBot } from '@/utils/analytics/visitor-hash'

/** Respuesta única. Nunca se filtra al cliente por qué se descartó un evento. */
const NO_CONTENT = new NextResponse(null, { status: 204 })

/**
 * Registra una vista de página de la landing.
 *
 * Responde **204 siempre**, se guarde o no: un fallo de analítica no puede
 * romper la navegación, y distinguir los casos en la respuesta solo serviría
 * para que alguien sondee la allowlist.
 *
 * El `path` llega del navegador y es entrada no confiable: se valida contra la
 * allowlist de `tracked-paths` y solo se inserta lo que esté en ella.
 *
 * La IP se usa para el hash y para limitar; nunca se persiste.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userAgent = request.headers.get('user-agent')
    if (isBot(userAgent)) return NO_CONTENT

    const ip = getClientIp(request.headers)

    // 120/h por IP: holgado para una sesión real de navegación, corta inundaciones.
    const rl = await rateLimit(rateLimitKey([ip, 'landing-event']), 120, 60 * 60 * 1000)
    if (!rl.ok) return NO_CONTENT

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NO_CONTENT
    }

    const path = normalisePath((body as { path?: unknown } | null)?.path)
    if (!path) return NO_CONTENT

    const visitorHash = dailyVisitorHash(ip, userAgent, new Date())
    if (!visitorHash) return NO_CONTENT // sin LANDING_ANALYTICS_SECRET

    const { error } = await createSupabaseAdmin()
      .from('landing_events')
      .insert({ path, visitor_hash: visitorHash })

    if (error) {
      console.error('[landing-event] insert failed', { message: error.message })
    }
  } catch (e) {
    console.error('[landing-event] unexpected', e)
  }

  return NO_CONTENT
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run __tests__/api/landing-event.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add app/api/landing-event/ __tests__/api/landing-event.test.ts
git commit -m "feat(analytics): add /api/landing-event ingest route

Always answers 204: analytics must never break navigation, and varying the
response would let someone probe the path allowlist. IP feeds the hash and
the rate limiter, and is never persisted."
```

---

## Task 5: Beacon de cliente

**Files:**
- Create: `components/LandingAnalytics.tsx`
- Modify: `app/layout.tsx`
- Test: `__tests__/components/landing-analytics.test.tsx`

**Interfaces:**
- Consumes: `normalisePath` (Task 2)
- Produces: `export default function LandingAnalytics(): null`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

let mockPath = '/'
vi.mock('next/navigation', () => ({ usePathname: () => mockPath }))

import LandingAnalytics from '@/components/LandingAnalytics'

const sendBeacon = vi.fn(() => true)

describe('LandingAnalytics', () => {
  beforeEach(() => {
    sendBeacon.mockClear()
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true })
  })

  it('manda un beacon en una ruta medida', () => {
    mockPath = '/curso-bachatango'
    render(<LandingAnalytics />)
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url, payload] = sendBeacon.mock.calls[0] as [string, Blob]
    expect(url).toBe('/api/landing-event')
    expect(payload).toBeInstanceOf(Blob)
  })

  it('no manda nada en rutas no medidas', () => {
    mockPath = '/admin/landing'
    render(<LandingAnalytics />)
    expect(sendBeacon).not.toHaveBeenCalled()
  })

  it('no duplica el envío si se vuelve a renderizar la misma ruta', () => {
    mockPath = '/'
    const { rerender } = render(<LandingAnalytics />)
    rerender(<LandingAnalytics />)
    expect(sendBeacon).toHaveBeenCalledTimes(1)
  })

  it('no renderiza nada en el DOM', () => {
    mockPath = '/'
    const { container } = render(<LandingAnalytics />)
    expect(container).toBeEmptyDOMElement()
  })

  it('no revienta si el navegador no soporta sendBeacon', () => {
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true })
    mockPath = '/'
    expect(() => render(<LandingAnalytics />)).not.toThrow()
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run __tests__/components/landing-analytics.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/LandingAnalytics"`

- [ ] **Step 3: Escribir el componente**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { normalisePath } from '@/utils/analytics/tracked-paths';

/**
 * Manda una vista de página a `/api/landing-event` al entrar en una ruta medida.
 *
 * Por qué en cliente y no en servidor: `/` y `/curso-bachatango` se sirven con
 * ISR, así que el componente de servidor se ejecuta una vez cada cinco minutos
 * aunque entren mil personas. Contar ahí perdería casi todo.
 *
 * Por qué no en el middleware: ya refresca la sesión de Supabase en cada
 * petición y está optimizado para saltárselo en tráfico anónimo. Añadirle una
 * escritura desharía esa optimización en TODAS las rutas, no solo las medidas.
 *
 * `sendBeacon` no bloquea la navegación y sobrevive a que el usuario se vaya.
 *
 * NO pasa por el banner de consentimiento: no deja cookies ni guarda datos
 * personales. Si eso cambia, hay que gatearlo y subir CONSENT_VERSION.
 */
export default function LandingAnalytics(): null {
  const pathname = usePathname();
  // React 19 en modo estricto monta dos veces en desarrollo; sin esto cada
  // visita contaría doble.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    const path = normalisePath(pathname);
    if (!path) return;
    if (lastSent.current === path) return;
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;

    lastSent.current = path;

    // Blob con content-type explícito: sendBeacon manda text/plain por defecto
    // y la ruta espera JSON.
    const payload = new Blob([JSON.stringify({ path })], { type: 'application/json' });
    navigator.sendBeacon('/api/landing-event', payload);
  }, [pathname]);

  return null;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run __tests__/components/landing-analytics.test.tsx`
Expected: PASS, 5 tests

- [ ] **Step 5: Montar en el layout**

En `app/layout.tsx`, añadir el import:

```tsx
import LandingAnalytics from '@/components/LandingAnalytics';
```

Y montarlo **fuera** de `ConsentProvider`, junto a `<Analytics />` y `<SpeedInsights />`, para que quede claro en el código que no depende del consentimiento:

```tsx
            <CookieConsent />
            <ThirdPartyScripts />
            {/* Sin cookies ni identificadores persistentes: no requieren
                consentimiento previo, así que van fuera del gate. */}
            <Analytics />
            <SpeedInsights />
            <LandingAnalytics />
```

- [ ] **Step 6: Comprobar en el navegador**

```bash
npm run dev
```

Con la pestaña Network abierta y filtrando por `landing-event`:
- En `/curso-bachatango`: **una** petición, con 204.
- Navegando a `/clase-gratis`: una más.
- Volviendo atrás a `/curso-bachatango`: una más (visita nueva, correcto).
- En `/admin`: **ninguna**.
- En la pestaña Payload solo debe verse `{"path":"..."}` — nada más.

Y que la fila llegó:

```bash
node -e "
require('dotenv').config({path:'.env.local'});
const {createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const {data}=await s.from('landing_events').select('path,visitor_hash,created_at').order('created_at',{ascending:false}).limit(5);
  console.table(data);
})();
" 2>&1 | grep -v injected
```
Expected: las rutas visitadas, con un `visitor_hash` de 64 hex. **Ninguna columna con IP.**

- [ ] **Step 7: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
git add components/LandingAnalytics.tsx app/layout.tsx __tests__/components/landing-analytics.test.tsx
git commit -m "feat(analytics): send page views from the client

Server-side counting would undercount badly: / and /curso-bachatango are ISR
cached, so the server component runs once every five minutes no matter how
many people arrive."
```

---

## Task 6: Consultas del panel

**Files:**
- Create: `utils/admin/landing-queries.ts`
- Modify: `utils/admin/queries.ts:569` (exportar `rangeStartIso`)
- Test: `__tests__/utils/landing-queries.test.ts`

**Interfaces:**
- Consumes: `Range` y `rangeStartIso` de `@/utils/admin/queries`, `FUNNEL_STEPS` (Task 2), `requireAdmin`, `createSupabaseAdmin`
- Produces:
  - `export type FunnelStep = { path: string; label: string; visitors: number; dropFromPrev: number | null }`
  - `export type TrafficDay = { date: string; views: number; uniques: number }`
  - `export async function getLandingFunnel(range: Range): Promise<FunnelStep[]>`
  - `export async function getLandingTraffic(range: Range): Promise<TrafficDay[]>`

- [ ] **Step 1: Exportar `rangeStartIso`**

En `utils/admin/queries.ts`, línea 569, añadir `export`:

```ts
export function rangeStartIso(range: Range): string | null {
```

Se reutiliza en lugar de duplicarlo: es la misma semántica de rango que el resto del panel.

- [ ] **Step 2: Escribir el test que falla**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/utils/auth/require-admin', () => ({ requireAdmin: vi.fn().mockResolvedValue({ id: 'admin' }) }))

const gteMock = vi.fn()
const selectMock = vi.fn(() => ({ gte: gteMock, then: undefined }))
const fromMock = vi.fn(() => ({ select: selectMock }))
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdmin: () => ({ from: fromMock }) }))

import { getLandingFunnel, getLandingTraffic } from '@/utils/admin/landing-queries'

/** 3 visitantes en la home, 2 llegan a venta, 1 compra. */
const ROWS = [
  { path: '/', visitor_hash: 'a', created_at: '2026-08-10T10:00:00Z' },
  { path: '/', visitor_hash: 'b', created_at: '2026-08-10T11:00:00Z' },
  { path: '/', visitor_hash: 'c', created_at: '2026-08-11T10:00:00Z' },
  { path: '/', visitor_hash: 'a', created_at: '2026-08-10T12:00:00Z' }, // repetida
  { path: '/curso-bachatango', visitor_hash: 'a', created_at: '2026-08-10T10:05:00Z' },
  { path: '/curso-bachatango', visitor_hash: 'b', created_at: '2026-08-10T11:05:00Z' },
  { path: '/curso-bachatango/comprar', visitor_hash: 'a', created_at: '2026-08-10T10:10:00Z' },
  { path: '/gracias', visitor_hash: 'a', created_at: '2026-08-10T10:12:00Z' },
]

beforeEach(() => {
  gteMock.mockReset().mockResolvedValue({ data: ROWS, error: null })
  fromMock.mockClear()
})

describe('getLandingFunnel', () => {
  it('cuenta únicos por paso', async () => {
    const f = await getLandingFunnel(90)
    expect(f.map(s => s.visitors)).toEqual([3, 2, 1, 1])
  })

  it('calcula el porcentaje que pasa al siguiente paso', async () => {
    const f = await getLandingFunnel(90)
    expect(f[0].dropFromPrev).toBeNull()
    expect(f[1].dropFromPrev).toBeCloseTo(66.67, 1)
    expect(f[2].dropFromPrev).toBeCloseTo(50, 1)
    expect(f[3].dropFromPrev).toBeCloseTo(100, 1)
  })

  it('no divide por cero cuando un paso está vacío', async () => {
    gteMock.mockResolvedValue({ data: [{ path: '/gracias', visitor_hash: 'z', created_at: '2026-08-10T10:00:00Z' }], error: null })
    const f = await getLandingFunnel(90)
    expect(f[0].visitors).toBe(0)
    expect(f[1].dropFromPrev).toBeNull()
    expect(Number.isFinite(f[3].visitors)).toBe(true)
  })

  it('devuelve los pasos aunque no haya datos', async () => {
    gteMock.mockResolvedValue({ data: [], error: null })
    const f = await getLandingFunnel(90)
    expect(f).toHaveLength(4)
    expect(f.every(s => s.visitors === 0)).toBe(true)
  })

  it('devuelve los pasos a cero si la query falla', async () => {
    gteMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const f = await getLandingFunnel(90)
    expect(f).toHaveLength(4)
    expect(f.every(s => s.visitors === 0)).toBe(true)
  })
})

describe('getLandingTraffic', () => {
  it('agrupa vistas y únicos por día', async () => {
    const t = await getLandingTraffic(90)
    expect(t).toEqual([
      { date: '2026-08-10', views: 6, uniques: 2 },
      { date: '2026-08-11', views: 2, uniques: 1 },
    ])
  })

  it('devuelve vacío si la query falla', async () => {
    gteMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getLandingTraffic(90)).toEqual([])
  })
})
```

- [ ] **Step 3: Ejecutar y verificar que falla**

Run: `npx vitest run __tests__/utils/landing-queries.test.ts`
Expected: FAIL — `Cannot find package '@/utils/admin/landing-queries'`

- [ ] **Step 4: Escribir el módulo**

```ts
import 'server-only'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { requireAdmin } from '@/utils/auth/require-admin'
import { rangeStartIso, type Range } from '@/utils/admin/queries'
import { FUNNEL_STEPS } from '@/utils/analytics/tracked-paths'

export type FunnelStep = {
  path: string
  label: string
  /** Únicos/día distintos que alcanzaron este paso en el rango. */
  visitors: number
  /** % de los del paso anterior que llegaron aquí. null en el primero. */
  dropFromPrev: number | null
}

export type TrafficDay = { date: string; views: number; uniques: number }

type Row = { path: string; visitor_hash: string; created_at: string }

/**
 * Lee los eventos del rango. Agrega en JS, igual que el resto de
 * `utils/admin/queries.ts`: PostgREST no hace `count(distinct)` y a este volumen
 * no compensa una vista materializada. Ver «Cuándo habrá que volver» en el spec.
 */
async function fetchRows(range: Range): Promise<Row[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const since = rangeStartIso(range)

  const q = sb.from('landing_events').select('path, visitor_hash, created_at')
  const { data, error } = await q.gte('created_at', since ?? '1970-01-01T00:00:00Z')

  if (error || !data) return []
  return data as Row[]
}

/**
 * Embudo por pasos.
 *
 * IMPORTANTE: son proporciones entre pasos, no recorridos seguidos persona a
 * persona. El hash caduca cada día, así que quien ve la página el martes y
 * compra el jueves cuenta en ambos pasos sin quedar enlazado. Encadenarlos
 * exigiría identificadores entre días, que es justo lo que se decidió no tener.
 * La página lo dice como nota al pie.
 */
export async function getLandingFunnel(range: Range): Promise<FunnelStep[]> {
  const rows = await fetchRows(range)

  const uniquesByPath = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = uniquesByPath.get(r.path) ?? new Set<string>()
    set.add(r.visitor_hash)
    uniquesByPath.set(r.path, set)
  }

  let prev: number | null = null
  return FUNNEL_STEPS.map((step) => {
    const visitors = uniquesByPath.get(step.path)?.size ?? 0
    const dropFromPrev = prev === null || prev === 0 ? null : (visitors / prev) * 100
    prev = visitors
    return { path: step.path, label: step.label, visitors, dropFromPrev }
  })
}

/** Serie diaria: vistas totales y únicos de ese día. */
export async function getLandingTraffic(range: Range): Promise<TrafficDay[]> {
  const rows = await fetchRows(range)

  const byDay = new Map<string, { views: number; uniques: Set<string> }>()
  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    const entry = byDay.get(day) ?? { views: 0, uniques: new Set<string>() }
    entry.views += 1
    entry.uniques.add(r.visitor_hash)
    byDay.set(day, entry)
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, views: v.views, uniques: v.uniques.size }))
}
```

- [ ] **Step 5: Ejecutar y verificar que pasa**

Run: `npx vitest run __tests__/utils/landing-queries.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 6: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add utils/admin/landing-queries.ts utils/admin/queries.ts __tests__/utils/landing-queries.test.ts
git commit -m "feat(admin): add landing funnel and traffic queries

Funnel figures are step-to-step ratios, not tracked journeys: the visitor
hash expires daily by design, so a Tuesday visit and a Thursday purchase
count in both steps without being linked."
```

---

## Task 7: Gráficas

**Files:**
- Create: `components/admin/charts/LandingFunnelChart.tsx`
- Create: `components/admin/charts/LandingTrafficChart.tsx`
- Test: `__tests__/components/landing-charts.test.tsx`

**Interfaces:**
- Consumes: `FunnelStep`, `TrafficDay` (Task 6), `ChartShell` de `./ChartShell`

- [ ] **Step 1: Escribir el test que falla**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Recharts necesita medir el contenedor; jsdom no tiene layout.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }
})

import LandingFunnelChart from '@/components/admin/charts/LandingFunnelChart'
import LandingTrafficChart from '@/components/admin/charts/LandingTrafficChart'
import type { FunnelStep, TrafficDay } from '@/utils/admin/landing-queries'

const FUNNEL: FunnelStep[] = [
  { path: '/', label: 'Inicio', visitors: 1240, dropFromPrev: null },
  { path: '/curso-bachatango', label: 'Página de venta', visitors: 223, dropFromPrev: 17.98 },
  { path: '/curso-bachatango/comprar', label: 'Formulario de compra', visitors: 27, dropFromPrev: 12.1 },
  { path: '/gracias', label: 'Compra completada', visitors: 17, dropFromPrev: 63.0 },
]

const TRAFFIC: TrafficDay[] = [
  { date: '2026-08-10', views: 120, uniques: 84 },
  { date: '2026-08-11', views: 96, uniques: 71 },
]

describe('LandingFunnelChart', () => {
  it('muestra los cuatro pasos con sus cifras', () => {
    render(<LandingFunnelChart data={FUNNEL} />)
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.getByText('Compra completada')).toBeInTheDocument()
    expect(screen.getByText('1.240')).toBeInTheDocument()
  })

  it('muestra el porcentaje de paso, salvo en el primero', () => {
    render(<LandingFunnelChart data={FUNNEL} />)
    expect(screen.getByText(/18,0\s*%/)).toBeInTheDocument()
    expect(screen.getByText(/12,1\s*%/)).toBeInTheDocument()
  })

  it('advierte de que son proporciones, no recorridos', () => {
    render(<LandingFunnelChart data={FUNNEL} />)
    expect(screen.getByText(/no recorridos seguidos|proporciones/i)).toBeInTheDocument()
  })

  it('muestra el estado vacío sin datos', () => {
    render(<LandingFunnelChart data={FUNNEL.map(s => ({ ...s, visitors: 0 }))} />)
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument()
  })
})

describe('LandingTrafficChart', () => {
  it('renderiza con datos', () => {
    render(<LandingTrafficChart data={TRAFFIC} />)
    expect(screen.getByText(/tráfico/i)).toBeInTheDocument()
  })

  it('muestra el estado vacío sin datos', () => {
    render(<LandingTrafficChart data={[]} />)
    expect(screen.getByText(/sin datos/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run __tests__/components/landing-charts.test.tsx`
Expected: FAIL — no existen los componentes

- [ ] **Step 3: Escribir el embudo**

El embudo se dibuja con barras proporcionales en CSS, no con Recharts: son cuatro valores con etiqueta y porcentaje, y una barra horizontal se lee mejor que un gráfico.

```tsx
'use client'

import ChartShell from './ChartShell'
import type { FunnelStep } from '@/utils/admin/landing-queries'
import styles from './charts.module.css'

const nf = new Intl.NumberFormat('es-ES')
const pf = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default function LandingFunnelChart({ data }: { data: FunnelStep[] }) {
  const top = data[0]?.visitors ?? 0
  const isEmpty = data.every((s) => s.visitors === 0)
  const conversion = top > 0 ? (data[data.length - 1].visitors / top) * 100 : null

  return (
    <ChartShell
      title="Embudo de venta"
      sub={conversion === null ? undefined : `Conversión total ${pf.format(conversion)} %`}
      isEmpty={isEmpty}
    >
      <ol className={styles.funnel}>
        {data.map((step) => (
          <li key={step.path} className={styles.funnelStep}>
            <div className={styles.funnelHead}>
              <span className={styles.funnelLabel}>{step.label}</span>
              <span className={styles.funnelValue}>{nf.format(step.visitors)}</span>
            </div>
            <div
              className={styles.funnelBar}
              style={{ width: top > 0 ? `${Math.max((step.visitors / top) * 100, 1)}%` : '1%' }}
            />
            {step.dropFromPrev !== null && (
              <span className={styles.funnelDrop}>
                ↓ {pf.format(step.dropFromPrev)} % pasa desde el paso anterior
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className={styles.funnelNote}>
        Son proporciones entre pasos, no recorridos seguidos persona a persona:
        el identificador caduca cada día, así que quien visita un martes y compra
        el jueves cuenta en ambos pasos sin quedar enlazado.
      </p>
    </ChartShell>
  )
}
```

- [ ] **Step 4: Escribir la serie de tráfico**

```tsx
'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import ChartShell from './ChartShell'
import type { TrafficDay } from '@/utils/admin/landing-queries'

export default function LandingTrafficChart({ data }: { data: TrafficDay[] }) {
  return (
    <ChartShell title="Tráfico" sub="Vistas y únicos por día" isEmpty={data.length === 0}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="rgba(0,0,0,0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={34} allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="views" name="Vistas" stroke="rgba(var(--primary-rgb), 0.9)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="uniques" name="Únicos/día" stroke="rgba(120,160,220,0.9)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
```

- [ ] **Step 5: Añadir los estilos del embudo**

Añadir al final de `components/admin/charts/charts.module.css`:

```css
/* ---------- Embudo ---------- */

.funnel {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1rem;
}

.funnelHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.funnelLabel {
  font-size: 0.85rem;
  font-weight: 600;
}

.funnelValue {
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
}

.funnelBar {
  height: 8px;
  border-radius: 999px;
  background: rgba(var(--primary-rgb), 0.85);
  margin-top: 0.35rem;
  min-width: 2px;
}

.funnelDrop {
  display: inline-block;
  margin-top: 0.3rem;
  font-size: 0.75rem;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

.funnelNote {
  margin: 1.25rem 0 0;
  font-size: 0.73rem;
  line-height: 1.5;
  opacity: 0.65;
}
```

- [ ] **Step 6: Ejecutar y verificar que pasa**

Run: `npx vitest run __tests__/components/landing-charts.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 7: Verificación y commit**

```bash
npm run lint && npx tsc --noEmit && npm test
git add components/admin/charts/ __tests__/components/landing-charts.test.tsx
git commit -m "feat(admin): add landing funnel and traffic charts

The funnel is CSS bars rather than Recharts: four labelled values read
better as horizontal bars. Carries the ratios-not-journeys caveat on screen."
```

---

## Task 8: Página `/admin/landing` y entrada en el menú

**Files:**
- Create: `app/admin/landing/page.tsx`
- Create: `app/admin/landing/landing.module.css`
- Modify: `components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `getLandingFunnel`, `getLandingTraffic` (Task 6), gráficas (Task 7), `RangePicker`

- [ ] **Step 1: Escribir la página**

```tsx
import RangePicker from '@/components/admin/charts/RangePicker'
import LandingFunnelChart from '@/components/admin/charts/LandingFunnelChart'
import LandingTrafficChart from '@/components/admin/charts/LandingTrafficChart'
import { getLandingFunnel, getLandingTraffic } from '@/utils/admin/landing-queries'
import type { Range } from '@/utils/admin/queries'
import styles from './landing.module.css'

export const dynamic = 'force-dynamic'

function parseRange(raw: string | undefined): Range {
  if (raw === '30') return 30
  if (raw === '365') return 365
  if (raw === 'all') return 'all'
  return 90
}

export default async function LandingStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const sp = await searchParams
  const range = parseRange(sp.range)
  const rangeKey = sp.range && ['30', '90', '365', 'all'].includes(sp.range) ? sp.range : '90'

  const [funnel, traffic] = await Promise.all([
    getLandingFunnel(range),
    getLandingTraffic(range),
  ])

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Landing</h1>
        <RangePicker value={rangeKey} />
      </header>

      <p className={styles.intro}>
        Medición propia, sin cookies y sin datos personales. Empieza el día que
        se desplegó: no hay histórico anterior.
      </p>

      <div className={styles.grid}>
        <LandingFunnelChart data={funnel} />
        <LandingTrafficChart data={traffic} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Escribir el CSS**

```css
.container {
  display: grid;
  gap: 1.25rem;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.title {
  font-size: 1.4rem;
  margin: 0;
}

.intro {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
  opacity: 0.7;
  max-width: 60ch;
}

.grid {
  display: grid;
  gap: 1.25rem;
}

@media (min-width: 1100px) {
  .grid {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}
```

- [ ] **Step 3: Añadir la entrada al menú**

En `components/admin/AdminSidebar.tsx`, añadir `Megaphone` a los iconos importados de `lucide-react`, y la entrada tras *Estadísticas*:

```tsx
    { href: '/admin/estadisticas', label: 'Estadísticas', Icon: BarChart3 },
    { href: '/admin/landing', label: 'Landing', Icon: Megaphone },
    { href: '/admin/entregas', label: 'Entregas', Icon: Inbox, badge: pendingSubmissions },
```

`isActive` ya funciona con `pathname?.startsWith(href)`, así que no hay que tocarlo.

- [ ] **Step 4: Comprobar en el navegador**

```bash
npm run dev
```

Con sesión de admin, en `http://localhost:3000/admin/landing`:
- La entrada «Landing» sale en el menú y se marca activa.
- Los cuatro pasos del embudo aparecen con sus barras.
- El `RangePicker` cambia el rango y la URL.
- La nota sobre proporciones se lee bajo el embudo.
- A 375 px de ancho las gráficas se apilan sin desbordar.

Y que la ruta está protegida:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin/landing
```
Expected: **307** (redirección a `/login`). `app/admin/layout.tsx` ya lo cubre con `requireAdmin()`, pero conviene confirmarlo.

- [ ] **Step 5: Verificación completa y commit**

```bash
npm run lint && npx tsc --noEmit && npm test && npm run build
git add app/admin/landing/ components/admin/AdminSidebar.tsx
git commit -m "feat(admin): add /admin/landing stats page"
```

---

## Task 9: E2E del beacon

**Files:**
- Modify: `e2e/landing-remediation.spec.ts`

- [ ] **Step 1: Añadir el bloque**

Al final de `e2e/landing-remediation.spec.ts`:

```ts
test.describe('Analítica de la landing', () => {
  test('manda exactamente un evento por visita a una ruta medida', async ({ page }) => {
    const events: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/landing-event')) events.push(r.url())
    })

    await page.goto('/curso-bachatango')
    await page.waitForLoadState('networkidle')

    expect(events).toHaveLength(1)
  })

  test('no manda eventos en rutas no medidas', async ({ page }) => {
    const events: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/landing-event')) events.push(r.url())
    })

    await page.goto('/legal/privacy')
    await page.waitForLoadState('networkidle')

    expect(events).toEqual([])
  })

  test('el beacon no deja cookies', async ({ page, context }) => {
    await page.goto('/curso-bachatango')
    await page.waitForLoadState('networkidle')

    const cookies = await context.cookies()
    expect(cookies.map((c) => c.name)).not.toContain('ls_visitor')
    // Solo debe haber, como mucho, la de consentimiento y las de sesión.
    expect(cookies.filter((c) => c.name.startsWith('ls_analytics'))).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar**

Run: `npx playwright test e2e/landing-remediation.spec.ts --reporter=list`
Expected: todos pasan, incluidos los 3 nuevos

- [ ] **Step 3: Commit**

```bash
git add e2e/landing-remediation.spec.ts
git commit -m "test(e2e): assert the landing beacon fires once and sets no cookies"
```

---

## Verificación final

- [ ] `npm run lint && npx tsc --noEmit && npm test && npm run build` — todo verde
- [ ] `npx playwright test` — todos pasan
- [ ] `npx tsx scripts/verify-anon-read.ts` — 6/6 (la tabla nueva no debe abrir nada)
- [ ] Con la anon key: SELECT sobre `landing_events` denegado o 0 filas; INSERT **denegado**
- [ ] En la BD: ninguna fila de `landing_events` contiene IP ni user-agent
- [ ] `/admin/landing` sin sesión → redirige a `/login`
- [ ] Navegar `/` → `/curso-bachatango` → `/clase-gratis` genera 3 filas y 1 solo `visitor_hash`
- [ ] `LANDING_ANALYTICS_SECRET` dada de alta en Vercel (producción)

## Auto-revisión del plan

**Cobertura del spec:** privacidad y hash → Task 3 · captura por beacon → Tasks 4-5 · esquema y RLS → Task 1 · allowlist como entrada no confiable → Task 2 · embudo y tráfico → Tasks 6-7 · página y menú → Task 8 · pruebas → tests de cada tarea más Task 9. La limitación «proporciones, no recorridos» aparece en el código (Task 6), en pantalla (Task 7) y en el test que lo verifica.

**Consistencia de tipos:** `TrackedPath` y `FUNNEL_STEPS` se definen en la Task 2 y los consumen las Tasks 4, 5 y 6. `FunnelStep` y `TrafficDay` se definen en la Task 6 y los consumen las Tasks 7 y 8. `dailyVisitorHash(ip, userAgent, now)` e `isBot(userAgent)` se definen en la Task 3 y los consume la Task 4. `Range` y `rangeStartIso` vienen de `utils/admin/queries.ts`, y la Task 6 exporta el segundo.

**Orden obligatorio:** Task 1 antes que la 4 (sin tabla no hay INSERT). Task 2 antes que la 4, la 5 y la 6. Task 3 antes que la 4. Task 6 antes que la 7 y la 8. Task 7 antes que la 8. La Task 9 va al final: necesita el beacon montado.
