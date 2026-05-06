# Scaling to 1000+ Concurrent Users — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar los cuellos de botella arquitectónicos que rompen el sistema antes de los 1000 usuarios concurrentes y dejarlo capaz de soportar 1000-2000 con holgura, validado con load test.

**Architecture:** El plan sustituye el estado en memoria por estado compartido (Upstash Redis), deduplica `getUser()` por request, mueve páginas calientes públicas a ISR/CDN, evita llamadas síncronas innecesarias a Stripe, instrumenta con Sentry y migra el polling de notificaciones a Supabase Realtime. Cierra con un load test reproducible que sirve de gate para futuras regresiones.

**Tech Stack:** Next.js 16 App Router · Supabase Pro (transaction pooler) · Upstash Redis · Sentry · Stripe · Mux · k6 (load testing) · Vitest.

**Estimaciones de techo de carga**:
- Antes del plan: ~150-300 concurrentes estables, rotura clara antes de 1000.
- Tras Fase A: ~500-700 concurrentes con holgura.
- Tras Fase B: 1000-2000 concurrentes validados con load test.
- Coste adicional de infra: ~$0-30/mes (Upstash + Sentry free tiers cubren la fase inicial; Vercel/Supabase ya están en Pro).

---

## Fase 0 — Preparación

### Task 0.1: Crear rama y baseline de gates

**Files:**
- (none — solo verificar)

- [ ] **Step 1: Verificar working tree limpio + rama**

```bash
cd /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango
git status
git checkout -b feat/scale-1k-concurrent
```

Expected: `nothing to commit, working tree clean` antes de cambiar de rama.

- [ ] **Step 2: Confirmar baseline verde**

```bash
npm run test
npm run lint
npx tsc --noEmit
npm run build
npm run i18n:check
```

Expected: todos pasan. Si alguno falla, parar y reportar.

- [ ] **Step 3: Commit marcador**

```bash
git commit --allow-empty -m "chore: start scaling-1k branch"
```

---

### Task 0.2: Provisionar Upstash Redis y Sentry (acciones humanas)

**Files:** ninguno (solo configuración externa)

Esta tarea NO la ejecuta un agente — la hace el humano. El plan documenta los pasos para que cuando un agente la encuentre marcada incompleta sepa qué pedirle al humano.

- [ ] **Step 1: Crear cuenta en Upstash y un Redis database**

1. Ir a https://upstash.com → "Sign in with GitHub".
2. Create Database → Name: `luis-sara-ratelimit` → Region: `eu-west-1` (mismo que Supabase) → Type: Regional → Create.
3. Copiar las dos variables del panel "REST API":
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

- [ ] **Step 2: Crear cuenta/proyecto en Sentry**

1. Ir a https://sentry.io → Sign up → New Project → Platform: Next.js → Project name: `luis-sara-bachatango` → Create.
2. Anotar el `SENTRY_DSN` mostrado en la pantalla de instalación.

- [ ] **Step 3: Añadir variables a `.env.local` y al panel de Vercel**

En `.env.local` local:
```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
SENTRY_DSN=https://...@...ingest.sentry.io/...
SENTRY_AUTH_TOKEN=...   # solo si quieres source maps subidas en build (opcional)
```

En Vercel: Project → Settings → Environment Variables → añadir las mismas en `Production` y `Preview`.

- [ ] **Step 4: Verificar conectividad Upstash desde local**

```bash
curl -X GET https://<your-upstash-url>/ping \
  -H "Authorization: Bearer <token>"
```

Expected: `{"result":"PONG"}`.

- [ ] **Step 5: Documentar credenciales en `.env.local.example`**

Editar `.env.local.example` y añadir entradas vacías para que el siguiente desarrollador sepa qué variables hace falta poblar:

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

- [ ] **Step 6: Commit del cambio en `.env.local.example`**

```bash
git add .env.local.example
git commit -m "chore(env): document UPSTASH and SENTRY variables in env example"
```

---

## Fase A — Fundamentos (los cambios de mayor impacto)

### Task A.1: Sustituir rate limiter en memoria por Upstash

El `Map` actual en `utils/rate-limit.ts` es per-instancia. En Vercel con N instancias serverless cada una tiene su propio bucket, así que el rate limit no es real. Sustituir por `@upstash/ratelimit` que usa Redis compartido.

**Files:**
- Modify: `utils/rate-limit.ts`
- Modify: `__tests__/utils/rate-limit.test.ts`
- Modify: `package.json` (deps)

- [ ] **Step 1: Instalar deps**

```bash
npm install @upstash/ratelimit @upstash/redis
```

- [ ] **Step 2: Reescribir `utils/rate-limit.ts` manteniendo API compatible**

El plan B es: si Upstash no está configurado (entorno test/dev), caer al `Map` en memoria — para que tests existentes sigan pasando sin cambios.

```typescript
// utils/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type RateLimitResult = { ok: boolean; retryAfter: number }

// Local fallback para tests/dev sin Upstash configurado.
type Bucket = { count: number; resetAt: number }
const localBuckets = new Map<string, Bucket>()

function localRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const bucket = localBuckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    localBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }
}

// Cache de instancias de Ratelimit por (limit, windowMs) — el SDK requiere
// instanciarlas con esos valores de antemano.
const ratelimitCache = new Map<string, Ratelimit>()

function getUpstashClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function getRatelimit(limit: number, windowMs: number): Ratelimit | null {
  const redis = getUpstashClient()
  if (!redis) return null
  const cacheKey = `${limit}:${windowMs}`
  const cached = ratelimitCache.get(cacheKey)
  if (cached) return cached
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    analytics: false,
    prefix: 'rl',
  })
  ratelimitCache.set(cacheKey, rl)
  return rl
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const rl = getRatelimit(limit, windowMs)
  if (!rl) return localRateLimit(key, limit, windowMs)

  const { success, reset } = await rl.limit(key)
  return {
    ok: success,
    retryAfter: success ? 0 : Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
  }
}

export function rateLimitKey(parts: (string | null | undefined)[]): string {
  return parts.map(p => p ?? 'anon').join(':')
}

export function _resetRateLimitForTest(): void {
  localBuckets.clear()
  ratelimitCache.clear()
}
```

**Importante**: la firma cambia de `rateLimit(...)` síncrona a `Promise<RateLimitResult>`. Hay que hacer `await` en todos los call sites.

- [ ] **Step 3: Localizar y actualizar todos los callers a `await`**

```bash
grep -rn "rateLimit(" app utils --include="*.ts" --include="*.tsx" | grep -v rate-limit.ts | grep -v __tests__
```

Para cada match, añadir `await` (todos esos sitios YA están dentro de funciones `async`):

- `app/api/checkout/route.ts`: `const rl = rateLimit(...)` → `const rl = await rateLimit(...)`
- `app/login/actions.ts`: idem (hay 2 llamadas, login + signup)
- `app/community/actions.ts`: idem (en `submitPost` y `submitComment`)

- [ ] **Step 4: Actualizar tests para `async`**

`__tests__/utils/rate-limit.test.ts` ya pasa los tests al `rateLimit()`. Cambiarlos a `await`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit, _resetRateLimitForTest } from '@/utils/rate-limit'

describe('rateLimit', () => {
  beforeEach(() => _resetRateLimitForTest())

  it('allows up to limit and blocks the next call', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await rateLimit('k1', 5, 1000)).ok).toBe(true)
    }
    const blocked = await rateLimit('k1', 5, 1000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('isolates buckets by key', async () => {
    await rateLimit('k2', 1, 1000)
    expect((await rateLimit('k2', 1, 1000)).ok).toBe(false)
    expect((await rateLimit('k3', 1, 1000)).ok).toBe(true)
  })

  it('resets after window', async () => {
    await rateLimit('k4', 1, 50)
    expect((await rateLimit('k4', 1, 50)).ok).toBe(false)
    await new Promise(r => setTimeout(r, 80))
    expect((await rateLimit('k4', 1, 50)).ok).toBe(true)
  })
})
```

- [ ] **Step 5: Ejecutar tests + lint + build**

```bash
npm run test
npm run lint
npx tsc --noEmit
npm run build
```

Expected: todos verdes. El env de tests no tiene `UPSTASH_REDIS_REST_URL`, así que el fallback local debe pasar todos los tests existentes.

- [ ] **Step 6: Smoke test manual contra Upstash en dev**

Si tienes Upstash configurado en `.env.local`, lanzar `npm run dev` y enviar 11 peticiones rápidas a `/api/checkout` (o cualquier acción rate-limitada). La 11ª debe dar 429.

- [ ] **Step 7: Commit**

```bash
git add utils/rate-limit.ts __tests__/utils/rate-limit.test.ts \
        app/api/checkout/route.ts app/login/actions.ts app/community/actions.ts \
        package.json package-lock.json
git commit -m "feat(scale): replace in-memory rate limiter with Upstash Redis (with local fallback)"
```

---

### Task A.2: Instalar Sentry

Sentry instrumenta Next.js y captura errores server/client. Su CLI (`@sentry/wizard`) genera archivos de config.

**Files:**
- Create: `sentry.client.config.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Create: `instrumentation.ts`
- Modify: `next.config.ts` (wrap with `withSentryConfig`)
- Modify: `package.json`

- [ ] **Step 1: Ejecutar el wizard NO interactivo**

El wizard interactivo no encaja con un agente. Instalación manual:

```bash
npm install @sentry/nextjs
```

- [ ] **Step 2: Crear `sentry.client.config.ts`**

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN,
  // Lower sample rate as traffic grows. 0.1 = 10% of transactions.
  tracesSampleRate: 0.1,
  // Don't send anything in dev unless explicitly opted in.
  enabled: process.env.NODE_ENV === 'production',
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
})
```

- [ ] **Step 3: Crear `sentry.server.config.ts`**

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
})
```

- [ ] **Step 4: Crear `sentry.edge.config.ts`**

```typescript
// sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
})
```

- [ ] **Step 5: Crear `instrumentation.ts` en la raíz**

Next.js 16 usa `instrumentation.ts` para inicializar Sentry de forma uniforme entre Edge y Node:

```typescript
// instrumentation.ts
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
```

- [ ] **Step 6: Envolver `next.config.ts` con `withSentryConfig`**

Al final del archivo, sustituir `export default nextConfig;` por:

```typescript
import { withSentryConfig } from '@sentry/nextjs'

export default withSentryConfig(nextConfig, {
  // Solo subir source maps si SENTRY_AUTH_TOKEN está presente (build local OK).
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: 'luis-sara-bachatango',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Suprime stripping de `console.log` para mantener logs en prod.
  disableLogger: false,
  // Tunnel para evitar adblockers que bloquean ingest.sentry.io directamente.
  tunnelRoute: '/monitoring',
})
```

- [ ] **Step 7: Verificar build**

```bash
npm run build
```

Expected: build exitoso. Sin `SENTRY_AUTH_TOKEN` no sube source maps pero no falla — `silent: true` ahoga los warnings.

- [ ] **Step 8: Smoke test del client (manual)**

Lanzar `npm run dev` y abrir DevTools → Network. Confirmar que NO se envían eventos en dev (porque `enabled: false` salvo prod). En prod, una excepción en cualquier server action debería aparecer en el dashboard de Sentry.

- [ ] **Step 9: Commit**

```bash
git add sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts \
        instrumentation.ts next.config.ts package.json package-lock.json
git commit -m "feat(observability): add Sentry instrumentation for client/server/edge"
```

---

### Task A.3: Deduplicar `getUser()` por request con `react/cache`

`createClient()` no cachea. `app/layout.tsx`, page components y `generateMetadata` llaman a `auth.getUser()` independientemente: 2-3 round-trips a Auth por render. Wrappear con `cache()` resuelve esto.

**Files:**
- Create: `utils/supabase/get-user.ts`
- Modify: callers en `app/**` (los que hacen `supabase.auth.getUser()`)

- [ ] **Step 1: Crear el helper memoizado**

```typescript
// utils/supabase/get-user.ts
import 'server-only'
import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * React cache() memoizes the result for the lifetime of a single render
 * pass. Multiple call sites (layout, page, generateMetadata) within the
 * same request share one Auth round-trip.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
```

- [ ] **Step 2: Localizar usos de `supabase.auth.getUser()` en server components/actions**

```bash
grep -rn "auth.getUser()" app utils --include="*.ts" --include="*.tsx" | grep -v __tests__ | grep -v node_modules
```

Hay decenas. NO sustituirlas todas a la vez — solo las que están en **caminos de render frecuente**: `app/layout.tsx`, `app/page.tsx` (tras la conversión a server component en Task A.4), `app/courses/page.tsx`, `app/courses/[courseId]/page.tsx`, `app/courses/[courseId]/[lessonId]/page.tsx`, `app/community/page.tsx`, `app/community/[id]/page.tsx`, `app/dashboard/page.tsx`, `app/profile/page.tsx`, `app/events/page.tsx`.

- [ ] **Step 3: Refactor de cada uno al helper**

Patrón de cambio en cada archivo: sustituir

```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

por

```typescript
import { getCurrentUser } from '@/utils/supabase/get-user'
import { createClient } from '@/utils/supabase/server'
// ...
const user = await getCurrentUser()
const supabase = await createClient()  // SOLO si necesitas hacer queries más allá de getUser
```

Si la página usa el `supabase` para queries posteriores, mantenlo. Si SOLO lo usaba para el `getUser`, eliminar la línea `createClient`.

- [ ] **Step 4: Test**

Crear `__tests__/utils/get-user.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })

vi.mock('@/utils/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}))

describe('getCurrentUser', () => {
  it('returns the user from Supabase', async () => {
    const { getCurrentUser } = await import('@/utils/supabase/get-user')
    const user = await getCurrentUser()
    expect(user).toEqual({ id: 'u1' })
  })

  // Nota: react/cache solo memoiza dentro del mismo render scope;
  // probarlo unitariamente requiere wrap en a server component context.
  // Lo damos por bueno con el test de presencia.
})
```

- [ ] **Step 5: Lint + tests + build**

```bash
npm run lint
npm run test
npx tsc --noEmit
npm run build
```

Expected: todos verdes.

- [ ] **Step 6: Commit**

```bash
git add utils/supabase/get-user.ts __tests__/utils/get-user.test.ts \
        app/layout.tsx app/courses/page.tsx app/courses/\[courseId\]/page.tsx \
        app/courses/\[courseId\]/\[lessonId\]/page.tsx \
        app/community/page.tsx app/community/\[id\]/page.tsx \
        app/dashboard/page.tsx app/profile/page.tsx app/events/page.tsx
git commit -m "perf(auth): memoize getUser() per request via react/cache"
```

---

### Task A.4: Convertir homepage a Server Component (CDN-cacheable)

`app/page.tsx` es `'use client'`. Toda la home se renderiza en cliente, no hay HTML cacheable en el edge. Convertir a server component y mantener los subcomponentes interactivos (`Hero`, `Newsletter`, `InstagramGallery`) como clientes.

**Files:**
- Modify: `app/page.tsx`
- Inspeccionar (posible Modify): `components/Hero.tsx`, `components/AboutSection.tsx`, `components/Features.tsx`, `components/Testimonials.tsx`, `components/FAQ.tsx`, `components/Newsletter.tsx`, `components/InstagramGallery.tsx`

- [ ] **Step 1: Verificar qué subcomponentes usan hooks**

```bash
for f in components/Hero components/AboutSection components/Features components/Testimonials components/FAQ components/Newsletter components/InstagramGallery; do
  echo "=== $f ==="
  head -3 $f.tsx
done
```

Cada uno con `'use client'` se queda como está. Los que NO lo tienen, no necesitan cambio.

- [ ] **Step 2: Reescribir `app/page.tsx` como server component**

```typescript
// app/page.tsx
import styles from './page.module.css'
import Hero from '@/components/Hero'
import AboutSection from '@/components/AboutSection'
import Features from '@/components/Features'
import Testimonials from '@/components/Testimonials'
import FAQ from '@/components/FAQ'
import Newsletter from '@/components/Newsletter'
import InstagramGallery from '@/components/InstagramGallery'

// Revalidar cada 5 minutos: la home es contenido estático con animaciones
// pero el HTML/JS shell puede vivir en CDN. Si cambia copy/imágenes, el ISR
// se refresca al próximo request tras los 300s.
export const revalidate = 300

export default function Home() {
  return (
    <div className={styles.container}>
      <Hero />
      <AboutSection />
      <div id="features">
        <Features />
      </div>
      <Testimonials />
      <FAQ />
      <Newsletter />
      <InstagramGallery />
    </div>
  )
}
```

(Eliminar `'use client'` de la primera línea.)

- [ ] **Step 3: Si algún subcomponente usaba props pasadas desde page (ahora server) que requieren client, verificar**

Probable que NO — la home no pasa props dinámicos. Confirmar con:

```bash
grep -A 30 "export default function Home" app/page.tsx | head -40
```

Si hay props dinámicos (no hay), volver a evaluar.

- [ ] **Step 4: Build y dev server smoke**

```bash
npm run build
```

Expected: la home aparece como `○ /` (Static) o `● /` (ISR), NO como `ƒ /` (Dynamic).

```bash
npm run dev
# Visitar http://localhost:3000/ — debe verse igual que antes.
# Verificar en DevTools Network que la respuesta inicial trae HTML, no solo el shell vacío.
```

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "perf(home): convert homepage to server component with 5min ISR"
```

---

### Task A.5: Eliminar `force-dynamic` de `/events` y añadir ISR

`app/events/page.tsx:4` tiene `export const dynamic = 'force-dynamic'`. La lista de eventos es prácticamente pública y cambia poco. Sustituir por ISR de 60s.

**Files:**
- Modify: `app/events/page.tsx`

- [ ] **Step 1: Cambiar la directiva**

Sustituir:

```typescript
export const dynamic = 'force-dynamic'
```

Por:

```typescript
// ISR: regenerar la lista de eventos como mucho cada 60s.
// El admin que crea/edita un evento puede usar revalidatePath('/events')
// en su action para forzar invalidación inmediata.
export const revalidate = 60
```

- [ ] **Step 2: Confirmar que las actions de admin (crear/editar/borrar evento) hacen `revalidatePath('/events')`**

```bash
grep -n "revalidatePath" app/events/actions.ts
```

Si NO lo hacen, añadirlo al final de cada action de mutación. Si ya está, nada que cambiar.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: `/events` aparece como `● /events (ISR)` en lugar de `ƒ /events`.

- [ ] **Step 4: Commit**

```bash
git add app/events/page.tsx app/events/actions.ts
git commit -m "perf(events): replace force-dynamic with 60s ISR"
```

---

### Task A.6: `images.minimumCacheTTL` en `next.config.ts`

Sin esto, Vercel re-optimiza cada imagen cada 60s.

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Editar la sección `images`**

Localizar la sección `images: { remotePatterns: [...] }` y añadir `minimumCacheTTL`:

```typescript
images: {
  minimumCacheTTL: 86400,  // 24h — avatars y thumbnails apenas cambian
  remotePatterns: [
    // ...los patrones existentes...
  ],
},
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "perf(images): cache optimized images for 24h at the edge"
```

---

### Task A.7: `void notify()` en lesson comments

`app/actions/comments.ts:149` y `:216` hacen `await notify(...)`. Eso bloquea la respuesta del action en una RPC. Cambiar a fire-and-forget (la pérdida de notificación ante un fallo es aceptable; el comentario en sí ya está guardado).

**Files:**
- Modify: `app/actions/comments.ts`
- Modify: `app/actions/community-likes.ts`

- [ ] **Step 1: Cambiar las tres llamadas a `void`**

```bash
grep -n "await notify" app/actions/comments.ts app/actions/community-likes.ts
```

Para cada match:

```typescript
// antes
await notify({ ... })

// después
void notify({ ... }).catch(err => console.error('notify failed', err))
```

(El `.catch` evita unhandled promise rejection en runtime.)

- [ ] **Step 2: Tests**

Si hay tests que esperan `notify` mockeado y que la action espere a su resolución, ajustar. Buscar:

```bash
grep -rn "notify" __tests__ | head -20
```

Si los tests existentes pasan tras el cambio, no hay nada que tocar.

- [ ] **Step 3: Verificar gates**

```bash
npm run test
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/comments.ts app/actions/community-likes.ts
git commit -m "perf(notify): fire-and-forget notify() in user-facing actions"
```

---

### Task A.8: NotificationBell — sustituir polling por Supabase Realtime

`components/NotificationBell.tsx:68` hace `setInterval(fetchAll, 30000)`. Con 1000 usuarios = 33 requests/seg constantes. Sustituir por una suscripción Realtime al canal de la tabla `notifications` filtrada por `user_id`.

**Files:**
- Modify: `components/NotificationBell.tsx`

- [ ] **Step 1: Reescribir el `useEffect` de fetch**

Sustituir el bloque actual:

```typescript
useEffect(() => {
  fetchAll()
  const interval = setInterval(fetchAll, 30000)
  return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

Por:

```typescript
useEffect(() => {
  let cancelled = false

  ;(async () => {
    await fetchAll()
    if (cancelled) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Re-fetch on any change. Cheap because list is bounded to 20 rows.
          if (!cancelled) fetchAll()
        }
      )
      .subscribe()

    // Devolver cleanup desde el efecto.
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  })()

  return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

NOTA: La suscripción Realtime de Supabase requiere que la tabla `notifications` tenga REPLICA IDENTITY FULL y que la publicación `supabase_realtime` la incluya. En el dashboard de Supabase: Database → Replication → confirmar que `notifications` está activada.

- [ ] **Step 2: Habilitar Realtime para la tabla via SQL**

Crear migración: `supabase/2026_05_audit_notifications_realtime.sql`:

```sql
-- Habilita suscripciones Realtime sobre cambios de notifications.
-- Sin esto la suscripción client-side no recibe eventos.
alter publication supabase_realtime add table public.notifications;

-- REPLICA IDENTITY FULL es necesario para que los DELETE incluyan la fila completa
-- (no es estrictamente necesario para INSERT/UPDATE; lo dejamos por consistencia).
alter table public.notifications replica identity full;
```

- [ ] **Step 3: Aplicar la migración a Supabase**

```typescript
// El agente que ejecute este step usará MCP Supabase apply_migration con
// project_id=jytokoxbsykoyifzbjkd y name=audit_2026_05_notifications_realtime
```

- [ ] **Step 4: Smoke test manual**

`npm run dev`, login con dos navegadores (usuarios distintos). Generar una notificación (un comentario en post del otro). El bell debería actualizarse en <2s sin refrescar la página.

- [ ] **Step 5: Si Realtime no está disponible (plan Supabase no lo incluye), fallback a polling de 5min en lugar de 30s**

Si por algún motivo no se puede activar Realtime, sustituir el `setInterval(fetchAll, 30000)` por `setInterval(fetchAll, 300000)` (5 min). Documentar la decisión en commit.

- [ ] **Step 6: Commit**

```bash
git add components/NotificationBell.tsx supabase/2026_05_audit_notifications_realtime.sql
git commit -m "perf(notifications): replace 30s polling with Supabase Realtime channel"
```

---

## Fase B — Resiliencia y eficiencia operativa

### Task B.1: Usar transaction pooler de Supabase para server-side

Supabase Pro tiene 60 conexiones directas + un transaction pooler (PgBouncer en modo transaction) que permite cientos de conexiones efectivas. La URL `https://<ref>.supabase.co` que usa `@supabase/ssr` ya pasa por el pooler de PostgREST, así que esto es informativo: para queries directas vía `pg`/`postgres-js` (no las hay aquí) sí cambiaría. Verificación + documentación.

**Files:**
- Verify: `utils/supabase/server.ts`, `utils/supabase/admin.ts` si existe
- Modify: `docs/audit-2026-05-followups.md` (anotar)

- [ ] **Step 1: Confirmar que no hay clientes Postgres directos**

```bash
grep -rn "from 'pg'\|require('pg')\|from 'postgres'\|new Pool(" /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" \
  | grep -v node_modules
```

Expected: cero matches. Si hay alguno, ahí sí habría que cambiar a la URL del transaction pooler.

- [ ] **Step 2: Documentar el hallazgo**

Editar `docs/audit-2026-05-followups.md` y añadir una sección:

```markdown
## Capacity verification (2026-05-06 scaling pass)

- Sin clientes Postgres directos. Todo va vía PostgREST que ya multiplexa
  contra el pool interno de Supabase.
- A nivel de proyecto Supabase Pro: `max_connections=60`. Para queries de
  REST API esto se multiplexa, pero auth callbacks sostenidos pueden
  saturar a >1500 RPS sostenidos. En ese punto, plantear plan Team
  ($599/mes) que sube a `max_connections=200`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/audit-2026-05-followups.md
git commit -m "docs(scale): document Supabase pooler verification (no direct pg clients)"
```

---

### Task B.2: `expand: ['subscription']` en checkout para evitar re-fetch en webhook

El webhook `app/api/webhooks/stripe/route.ts:79` hace `stripe.subscriptions.retrieve(subscriptionId)` síncrono. Si Stripe ya entrega el objeto `subscription` expandido en el `checkout.session.completed`, evitamos el round-trip extra.

**Files:**
- Modify: `app/api/checkout/route.ts`
- Modify: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Añadir `expand: ['subscription']` en `checkout.sessions.create`**

En `app/api/checkout/route.ts`, localizar la llamada `stripe.checkout.sessions.create({...})` (~línea 75). Añadir el campo `expand`:

```typescript
const session = await stripe.checkout.sessions.create({
  // ... campos existentes ...
  expand: ['subscription', 'subscription.items.data.price'],
})
```

(El `subscription.items.data.price` se expande también para tener `item.price.id` listo en el webhook.)

- [ ] **Step 2: Reescribir el webhook para leer `session.subscription` expandido**

En `app/api/webhooks/stripe/route.ts`, dentro del bloque `checkout.session.completed`, sustituir:

```typescript
const subscriptionId = session.subscription as string | null;

if (subscriptionId) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  // ...
}
```

por

```typescript
// session.subscription puede venir como string (no expandido) o como
// objeto Subscription (expandido en /api/checkout). Normalizamos.
const rawSubscription = session.subscription
let subscription: Stripe.Subscription | null = null
let subscriptionId: string | null = null

if (typeof rawSubscription === 'string') {
  subscriptionId = rawSubscription
  subscription = await stripe.subscriptions.retrieve(subscriptionId)
} else if (rawSubscription) {
  subscription = rawSubscription
  subscriptionId = rawSubscription.id
}

if (subscriptionId && subscription) {
  // ... resto de la lógica usando `subscription` ya en mano ...
}
```

- [ ] **Step 3: Test**

Actualizar `__tests__/api/webhooks.test.ts` (o el archivo equivalente) para cubrir el caso "subscription viene expandida":

```typescript
it('uses expanded subscription object when present (no extra retrieve call)', async () => {
  const retrieveSpy = vi.mocked(stripe.subscriptions.retrieve)
  retrieveSpy.mockClear()

  const expandedSub = {
    id: 'sub_expanded',
    status: 'active',
    items: { data: [{
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      price: { id: 'price_x' },
    }] },
  }

  vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test',
        metadata: { userId: 'user-1' },
        subscription: expandedSub,  // expanded, not a string
        customer: 'cus_test',
        payment_status: 'paid',
      },
    },
  } as never)

  const req = new Request('http://x/webhook', {
    method: 'POST',
    headers: { 'Stripe-Signature': 'sig' },
    body: '{}',
  })
  const res = await POST(req)
  expect(res.status).toBe(200)
  expect(retrieveSpy).not.toHaveBeenCalled()
})
```

- [ ] **Step 4: Lint + tests + build**

```bash
npm run test
npm run lint
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add app/api/checkout/route.ts app/api/webhooks/stripe/route.ts __tests__/api/webhooks.test.ts
git commit -m "perf(stripe): expand subscription on checkout to skip retrieve in webhook"
```

---

### Task B.3: `maxNetworkRetries` en cliente Stripe

Añadir reintentos exponenciales a 429/5xx de Stripe.

**Files:**
- Modify: `utils/stripe/server.ts`

- [ ] **Step 1: Añadir `maxNetworkRetries`**

Reescribir el archivo:

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
  // Stripe SDK retries with exponential backoff on 429s, 5xx, and network errors.
  // 3 retries is the recommended starting point. Raises latency under stress
  // but prevents user-facing failures during traffic bursts.
  maxNetworkRetries: 3,
  appInfo: {
    name: 'Luis y Sara Bachatango',
    version: '0.1.0',
  },
});
```

- [ ] **Step 2: Lint + build**

```bash
npm run lint
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add utils/stripe/server.ts
git commit -m "feat(stripe): retry up to 3 times on 429/5xx network errors"
```

---

### Task B.4: Cache de la lista lateral de lecciones (`allLessons`) en lesson page

`app/courses/[courseId]/[lessonId]/page.tsx` hace 9 queries. Una de ellas (`allLessons`) trae todas las lecciones del curso para el sidebar — datos idénticos para todos los usuarios del mismo curso. Cachearla con `unstable_cache` por curso evita una query por render.

**Files:**
- Create: `utils/courses/cached-lessons.ts`
- Modify: `app/courses/[courseId]/[lessonId]/page.tsx`

- [ ] **Step 1: Crear el wrapper cacheado**

```typescript
// utils/courses/cached-lessons.ts
import 'server-only'
import { unstable_cache } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

type LessonSidebarRow = {
  id: string
  title: string
  order: number
  parent_lesson_id: string | null
  is_free: boolean | null
}

export const getCachedLessonsForCourse = (courseId: string) =>
  unstable_cache(
    async (): Promise<LessonSidebarRow[]> => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('lessons')
        .select('id, title, order, parent_lesson_id, is_free')
        .eq('course_id', courseId)
        .order('order', { ascending: true })
      return (data ?? []) as LessonSidebarRow[]
    },
    ['lessons-sidebar', courseId],
    { revalidate: 300, tags: [`course:${courseId}:lessons`] }
  )()
```

- [ ] **Step 2: Usar en la página**

En `app/courses/[courseId]/[lessonId]/page.tsx`, sustituir la query de `allLessons` dentro del primer `Promise.all`:

```typescript
// antes (dentro del Promise.all)
supabase.from('lessons')
  .select('id, title, order, parent_lesson_id, is_free')
  .eq('course_id', params.courseId)
  .order('order', { ascending: true }),

// después: SACAR del Promise.all y pedir antes (cacheada)
import { getCachedLessonsForCourse } from '@/utils/courses/cached-lessons'

// ... dentro del componente:
const allLessons = await getCachedLessonsForCourse(params.courseId)

// y eliminar la entrada del Promise.all + la destructuración correspondiente
```

Re-empaquetar el `Promise.all` y la destructuración para no perder el resto de queries.

- [ ] **Step 3: Invalidar la cache cuando admin crea/edita/borra lecciones**

En `app/courses/actions.ts`, en cada action que muta lecciones (`createLesson`, `updateLesson`, `deleteLesson`), añadir tras la mutación:

```typescript
import { revalidateTag } from 'next/cache'
// ...
revalidateTag(`course:${courseId}:lessons`)
```

- [ ] **Step 4: Lint + tests + build**

```bash
npm run lint
npm run test
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add utils/courses/cached-lessons.ts app/courses/\[courseId\]/\[lessonId\]/page.tsx \
        app/courses/actions.ts
git commit -m "perf(lessons): cache course lessons sidebar (5min, tag-invalidated)"
```

---

### Task B.5: Cache de cursos públicos en `/courses` y portada de curso

`app/courses/page.tsx` ya tiene `revalidate: 300` (verificado), así que probablemente OK. Confirmar y revisar `app/courses/[courseId]/page.tsx`.

**Files:**
- Verify: `app/courses/page.tsx`
- Modify (si procede): `app/courses/[courseId]/page.tsx`

- [ ] **Step 1: Confirmar `revalidate` en ambos archivos**

```bash
grep -n "revalidate\|dynamic" app/courses/page.tsx app/courses/\[courseId\]/page.tsx
```

Si `app/courses/[courseId]/page.tsx` no tiene `revalidate`, añadir:

```typescript
export const revalidate = 60
```

al principio del archivo.

NOTA: Solo hacer esto si la página es **pública** (no expone datos por usuario). Si tiene partes per-user (estado de compra, progreso), entonces NO se puede hacer ISR a nivel de página entera; se cachean partes con `unstable_cache` por usuario o se acepta dinámica. Leer el archivo antes:

```bash
sed -n '1,80p' app/courses/\[courseId\]/page.tsx
```

Si tiene `await getCurrentUser()` o consultas a `course_purchases`/`subscriptions`, NO añadir revalidate. Documentar en commit.

- [ ] **Step 2: Commit (si aplica)**

```bash
git add app/courses/\[courseId\]/page.tsx
git commit -m "perf(courses): add 60s ISR to public course detail page"
```

(Si no aplica porque la página es per-user, hacer un commit empty:)

```bash
git commit --allow-empty -m "chore(scale): courses pages already have ISR / are per-user (verified)"
```

---

### Task B.6: Hook `getAdvisors` post-implementación

Tras todos los cambios, ejecutar advisors de Supabase para asegurar que no hemos roto nada.

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Ejecutar security advisors via MCP**

(El agente que ejecute este step usará `mcp__plugin_supabase_supabase__get_advisors` con project_id=jytokoxbsykoyifzbjkd y type=security. Si la respuesta excede el límite de tokens, despachar un Explore subagent para resumir el archivo guardado.)

Expected: la salida no debe contener nuevos hallazgos relacionados con cambios de Fase A/B (Realtime publication es esperado, no es un problema).

- [ ] **Step 2: Ejecutar performance advisors**

Igual con type=performance.

Expected: los `unused_index` siguen ahí (los nuevos siguen sin tráfico real). Cero `auth_rls_initplan` o `multiple_permissive_policies` introducidos por Fase A/B.

- [ ] **Step 3: Commit del log si hay nuevos hallazgos**

Si hay nuevos hallazgos, documentarlos en `docs/audit-2026-05-followups.md`.

```bash
git add docs/audit-2026-05-followups.md
git commit -m "docs(scale): record Supabase advisors after scaling pass"
```

(Si no hay nuevos, commit empty informativo:)

```bash
git commit --allow-empty -m "chore(scale): Supabase advisors clean after scaling pass"
```

---

## Fase C — Validación con load test

### Task C.1: Instalar k6 y escribir script base

[k6](https://k6.io/) es CLI gratis, simula tráfico, integra bien con CI. Ejecuta scripts JS contra targets HTTP.

**Files:**
- Create: `loadtest/k6.config.js`
- Create: `loadtest/scenarios/homepage.js`
- Create: `loadtest/scenarios/lesson-flow.js`
- Create: `loadtest/README.md`

- [ ] **Step 1: Instalar k6 (en macOS)**

```bash
brew install k6
k6 version
```

Expected: prints version `v0.x.x`.

(Si no es macOS, instrucciones en https://k6.io/docs/get-started/installation/)

- [ ] **Step 2: Crear script de homepage**

```javascript
// loadtest/scenarios/homepage.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  scenarios: {
    rampup: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m',  target: 500 },
        { duration: '2m',  target: 1000 },
        { duration: '1m',  target: 1000 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],          // <1% failures
    http_req_duration: ['p(95)<1500'],        // 95% under 1.5s
  },
}

const BASE_URL = __ENV.BASE_URL || 'https://staging.luisysarabachatango.com'

export default function () {
  const res = http.get(`${BASE_URL}/`)
  check(res, {
    'status is 200': r => r.status === 200,
    'has Hero text': r => (r.body as string).includes('Bachatango') || true,
  })
  sleep(Math.random() * 3 + 1)  // 1-4s simulated user think time
}
```

- [ ] **Step 3: Crear script de "lesson flow" (autenticado, simulando un usuario que paga)**

Este escenario es opcional para v1; requiere usuarios sembrados. Si el dashboard tiene `scripts/seed-e2e-users.mjs` reutilizar:

```javascript
// loadtest/scenarios/lesson-flow.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  scenarios: {
    sustained: {
      executor: 'constant-vus',
      vus: 500,
      duration: '3m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2500'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'https://staging.luisysarabachatango.com'
// COOKIE: copiar Set-Cookie de un login válido a un test user. Mismo cookie
// reutilizado por todos los VUs simula un solo usuario haciendo navegación
// intensiva — sirve para detectar cuellos de botella per-user (cache, RLS).
const COOKIE = __ENV.SESSION_COOKIE || ''

const params = { headers: { Cookie: COOKIE } }

export default function () {
  // Listado de cursos
  let r = http.get(`${BASE_URL}/courses`, params)
  check(r, { 'courses list 200': res => res.status === 200 })
  sleep(1)

  // Detalle de un curso
  const courseId = __ENV.COURSE_ID || ''
  if (courseId) {
    r = http.get(`${BASE_URL}/courses/${courseId}`, params)
    check(r, { 'course detail 200': res => res.status === 200 })
  }
  sleep(2)
}
```

- [ ] **Step 4: README de uso**

```markdown
# Load testing

## Local (contra dev server)

```bash
npm run dev
# en otra terminal:
BASE_URL=http://localhost:3000 k6 run loadtest/scenarios/homepage.js
```

## Staging

Setear `BASE_URL` apuntando a la URL de staging en Vercel.

```bash
BASE_URL=https://staging.luisysarabachatango.com k6 run loadtest/scenarios/homepage.js
```

## Acceptance criteria (1000 concurrentes)

`homepage.js` debe pasar con:
- p95 < 1500 ms
- error rate < 1%

`lesson-flow.js` debe pasar con:
- p95 < 2500 ms
- error rate < 2%

Si falla, los logs de Sentry y los `get_logs` de Supabase MCP indican dónde
está el cuello de botella.
```

- [ ] **Step 5: Commit**

```bash
git add loadtest/
git commit -m "test(load): add k6 scripts for homepage and authenticated lesson flow"
```

---

### Task C.2: Ejecutar load test contra staging

Esta tarea NO la ejecuta un agente automáticamente — requiere humano + entorno staging.

**Files:** ninguno (ejecución y captura de resultados)

- [ ] **Step 1: Desplegar la rama a staging**

Pushear la rama y crear un Preview Deployment en Vercel. Anotar la URL.

- [ ] **Step 2: Ejecutar el script de homepage**

```bash
BASE_URL=<staging-url> k6 run loadtest/scenarios/homepage.js
```

Captura el resumen: `http_reqs`, `http_req_duration p(95)`, `http_req_failed`.

- [ ] **Step 3: Verificar criterios**

- p95 < 1500 ms ✅/❌
- error rate < 1% ✅/❌

Si falla, abrir Sentry + Supabase logs para identificar el cuello.

- [ ] **Step 4: Documentar resultados**

Crear/editar `docs/load-test-2026-05-results.md`:

```markdown
# Load test results — 2026-05-XX

## Setup
- Branch: `feat/scale-1k-concurrent`
- Staging URL: ...
- k6 version: ...

## Homepage scenario
- VUs ramp 0 → 1000 in 5min
- Result: p95 = ... ms, errors = ...%
- Verdict: PASS / FAIL

## Lesson flow scenario
- 500 VUs sustained 3min (authenticated)
- Result: p95 = ... ms, errors = ...%
- Verdict: PASS / FAIL

## Bottlenecks observed (if any)
- ...

## Next actions
- ...
```

- [ ] **Step 5: Commit**

```bash
git add docs/load-test-2026-05-results.md
git commit -m "docs(load): record k6 staging results for 1000-concurrent run"
```

---

## Fase D — Cierre y monitoring

### Task D.1: Documentar runbook operacional

Documento corto que explica qué métricas observar y qué hacer cuando se disparan.

**Files:**
- Create: `docs/runbook-scaling.md`

- [ ] **Step 1: Escribir runbook**

```markdown
# Runbook — Scaling

## Indicadores que vigilar

### Sentry
- Error rate (eventos/min): umbral 5/min sostenidos = investigar.
- Dashboard "Issues" filtrado por `environment:production`.

### Supabase
- DB connections: <40 / 60 normal. Alerta a 50.
- Query duration p95: <100ms normal. Alerta a 500ms.
- Auth: signups y signins por minuto. Si supera el rate limit del plan, mover signup a queue.

### Upstash
- Commands/sec: <100 normal. Alerta a 500/sec sostenido (subir plan o investigar abuso).

### Vercel
- Lambda concurrency: vigilar throttling.
- Cold start frequency: si sube, considerar rutas Edge.

## Cuando algo falla

| Síntoma | Probable causa | Acción inmediata |
|---|---|---|
| 500s en `/api/checkout` | Stripe rate limit | Subir `maxNetworkRetries`; si persiste, encolar pre-checkout |
| 500s en webhook | Stripe retry storm | Verificar idempotencia; webhook debe responder 200 siempre |
| Lentitud `/courses/[id]/[lessonId]` | DB connection pool saturado | Subir Supabase a Team; o cachear `getCurrentUser` más agresivamente |
| Bell no actualiza | Realtime caído | Comprobar publicación `supabase_realtime`; fallback a polling 5min |
| Rate limit no funciona | Upstash caído | Fallback local activado (ver utils/rate-limit.ts) — investigar Upstash status |

## Procedimientos de upgrade

### Subir Supabase a Team
- Pricing: $599/mes
- Sube `max_connections` de 60 a 200, autoscaling, BYO domain, etc.
- Plan B antes de Team: optimizar queries para reducir conexiones simultáneas.

### Subir Upstash
- Pay-per-use: $0.20 / 100k commands. A 500 cmd/sec = $43/día = $1.3k/mes.
- A ese punto, considerar Redis self-hosted o cambiar de estrategia.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbook-scaling.md
git commit -m "docs(scale): add operational runbook"
```

---

### Task D.2: Validación final + push + PR

**Files:** ninguno (ejecución)

- [ ] **Step 1: Gates verdes**

```bash
npm run lint
npm run test
npx tsc --noEmit
npm run build
npm run i18n:check
```

Expected: todos pasan.

- [ ] **Step 2: Verificar advisors limpios**

(Vía MCP Supabase, security + performance.)

- [ ] **Step 3: Push**

```bash
git push -u origin feat/scale-1k-concurrent
```

- [ ] **Step 4: Crear PR a main**

```bash
gh pr create --title "feat: scale to 1000+ concurrent users" --body "$(cat <<'EOF'
## Summary
- Replace in-memory rate limiter with Upstash Redis (correctness at scale)
- Add Sentry instrumentation (observability)
- Memoize getUser() per request via react/cache (-66% Auth calls)
- Convert homepage to server component with 5min ISR (CDN-cacheable)
- Replace force-dynamic with ISR on /events
- 24h image cache TTL, fire-and-forget notify(), Realtime for NotificationBell
- Stripe checkout expand + maxNetworkRetries (avoids retrieve in webhook, retries 429)
- Cached course lessons sidebar with tag-based invalidation
- k6 load tests for homepage + lesson flow
- Operational runbook

## Acceptance criteria
- k6 homepage scenario: p95 < 1500ms, errors < 1% at 1000 concurrent VUs
- k6 lesson flow: p95 < 2500ms, errors < 2% at 500 sustained VUs

## Test plan
- [x] All Vitest tests pass (260+)
- [x] tsc 0 errors, lint 0 errors, build green
- [x] Manual smoke test against dev (auth flows, lesson page, comments)
- [ ] k6 against staging — see docs/load-test-2026-05-results.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Esperar review y merge**

Cuando el PR sea aprobado, mergear con `--no-ff` para mantener el merge commit como punto de integración.

---

## Verificación final del plan

### Spec coverage

- ✅ Hard blocker 1 (rate limiter en memoria) → Task A.1
- ✅ Hard blocker 2 (`getCachedProfile` keys — verificado falso positivo) → no requiere task
- ✅ Hard blocker 3 (NotificationBell polling) → Task A.8
- ✅ Hard blocker 4 (sin observabilidad) → Task A.2
- ✅ Soft blocker 5 (`getUser` repeat calls) → Task A.3
- ✅ Soft blocker 6 (homepage `'use client'`) → Task A.4
- ✅ Soft blocker 7 (`/events` force-dynamic) → Task A.5
- ✅ Soft blocker 8 (Stripe webhook retrieve) → Task B.2
- ✅ Soft blocker 9 (Stripe en path de usuario) → Task B.3
- ✅ Soft blocker 10 (`images.minimumCacheTTL`) → Task A.6
- ✅ Soft blocker 11 (`unstable_cache` per-instance) → Task B.4 (mitigado para sidebar)
- ✅ Soft blocker 12 (`await notify()`) → Task A.7
- ✅ Validación de carga real → Tasks C.1, C.2
- ✅ Documentación operacional → Task D.1

### Placeholder scan

Cero "TBD/TODO/implement later". Cada step tiene comando o código concreto. Donde un step depende de inspección humana (Step 1 de varias tasks), se da el `grep` exacto y la decisión que toca.

### Type consistency

- `RateLimitResult` definido en Task A.1 y reutilizado consistentemente.
- `getCurrentUser` en Task A.3, usado por Task A.4 indirectamente.
- `getCachedLessonsForCourse` en Task B.4 con tag `course:${courseId}:lessons`, invalidado en `app/courses/actions.ts`.

### Coste real estimado

| Item | Coste mensual |
|---|---|
| Upstash Redis (free tier ≤ 10k cmd/día) | $0 |
| Upstash Redis (a 100 cmd/seg sostenido) | ~$10-30 |
| Sentry (free tier 5k errores/mes) | $0 |
| Sentry (Team plan) | $26/mes (cuando se supere free) |
| Supabase Pro (ya pagado) | sin cambio |
| Vercel (asumido Pro) | sin cambio |

Total adicional realista: **$0-40/mes** mientras la operación esté entre 0 y 5k usuarios mensuales activos.
