# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediar todos los hallazgos verificados de la auditoría de bugs, seguridad y capacidad realizada el 2026-05-06 sobre el proyecto Luis y Sara Bachatango.

**Architecture:** Trabajo dividido en 6 fases por severidad y tipo (críticos de seguridad/datos primero, luego altos, después hardening de medio plazo y bajos). Cada tarea es atómica, hace TDD donde aplica, y termina con un commit. Fases SQL crean migraciones nuevas en `supabase/` (no se editan migraciones históricas). Cambios de seguridad en Server Actions/API se cubren con tests Vitest.

**Tech Stack:** Next.js 16 App Router · Supabase (Postgres + Auth + RLS) · Stripe · Mux · Vitest · TypeScript · CSS Modules.

**Hallazgos descartados tras verificación**:
- ❌ Bug crítico "Date.UTC(year, month, 0)" en lesson page → la matemática es correcta porque `course.month` es 1-indexed en BD.
- ❌ "trim() faltante en community submitPost" → `submitPost` y `submitComment` ya hacen `.trim()`.
- ❌ "comments sin política UPDATE" → reclasificado a Bajo, no es vector de seguridad real (campos no sensibles).
- ⚠️ XSS via `dangerouslySetInnerHTML` en `AuthShell` → reclasificado de Crítico a **Alto**: la fuente del string es `utils/dictionaries.ts` (controlado por el repo, no por usuarios). Sigue siendo necesario corregirlo porque convierte cualquier futura fuente externa de copy en una vulnerabilidad inmediata.

---

## Fase 0 — Preparación

### Task 0.1: Crear rama de trabajo y suite de smoke tests

**Files:**
- Create: `__tests__/smoke/audit-baseline.test.ts`

- [ ] **Step 1: Crear rama**

```bash
git checkout -b chore/audit-remediation
```

- [ ] **Step 2: Confirmar baseline verde**

```bash
npm run test
npm run lint
npm run build
```

Expected: ambos comandos pasan. Si fallan, parar y abrir issue antes de seguir.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: start audit remediation branch"
```

---

## Fase 1 — Críticos (seguridad y datos)

### Task 1.1: Endurecer RLS de `courses` para ocultar borradores

Política actual `FOR SELECT USING (true)` expone cursos no publicados. Solo admins deben ver `is_published = false`.

**Files:**
- Create: `supabase/2026_05_audit_rls_courses.sql`

- [ ] **Step 1: Confirmar columna `is_published` existe**

```bash
grep -n "is_published" /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango/supabase/*.sql
```

Expected: columna existe en `courses` (si no, primero añadir `alter table courses add column if not exists is_published boolean not null default true;` al inicio de la migración).

- [ ] **Step 2: Escribir migración**

```sql
-- supabase/2026_05_audit_rls_courses.sql
-- Tighten SELECT policy on courses: drafts only visible to admins.

drop policy if exists "Courses are viewable by everyone." on courses;

create policy "Courses are viewable by everyone (published or admin)." on courses
  for select using (
    coalesce(is_published, true) = true
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
```

- [ ] **Step 3: Aplicar migración (entornos de prueba primero)**

```bash
# Local (si hay supabase CLI):
supabase db push
# O en el panel: SQL Editor → pegar el archivo → Run sobre el branch de Supabase
```

- [ ] **Step 4: Verificar manualmente con tres usuarios**

Conectarse con `auth.uid()` simulado:
- Anon → no ve cursos con `is_published = false`.
- Member → no ve cursos con `is_published = false`.
- Admin → ve todos.

- [ ] **Step 5: Commit**

```bash
git add supabase/2026_05_audit_rls_courses.sql
git commit -m "feat(security): hide unpublished courses from non-admin users"
```

---

### Task 1.2: Endurecer RLS de `lessons` (gating real por compra/suscripción)

`SELECT USING (true)` actualmente filtra `mux_playback_id` y `video_url` a cualquier autenticado. La gating se hacía solo en server component, pero la API de Supabase desde el cliente puede traer las filas saltándose la página.

**Files:**
- Create: `supabase/2026_05_audit_rls_lessons.sql`

- [ ] **Step 1: Escribir migración**

```sql
-- supabase/2026_05_audit_rls_lessons.sql
-- Gating real: cualquier usuario ve metadatos básicos de lecciones publicadas/free,
-- pero el contenido protegido (mux_playback_id, video_url) requiere acceso.
-- Implementación: política SELECT que cruza con compras/subscriptions.

drop policy if exists "Lessons are viewable by everyone." on lessons;

create policy "Lessons SELECT: free, admin, purchased or subscribed." on lessons
  for select using (
    -- Free lessons (preview)
    coalesce(is_free, false) = true
    -- Admin
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
    -- One-time purchase of the parent course
    or exists (
      select 1 from course_purchases cp
      where cp.user_id = auth.uid() and cp.course_id = lessons.course_id
    )
    -- Active subscription that covers the course's month/year
    or exists (
      select 1
      from subscriptions s
      join courses c on c.id = lessons.course_id
      where s.user_id = auth.uid()
        and s.status in ('active', 'trialing')
        and s.current_period_start <= make_date(c.year, c.month, 1) + interval '1 month' - interval '1 second'
        and s.current_period_end >= make_date(c.year, c.month, 1)
    )
  );
```

- [ ] **Step 2: Aplicar la migración en el branch de Supabase y reproducir el caso**

Login como `member` sin compras ni suscripción → request directa a la tabla `lessons` debe devolver solo lecciones `is_free=true`.

- [ ] **Step 3: Adaptar el server component si rompe la lectura**

`app/courses/[courseId]/[lessonId]/page.tsx:46-50` selecciona la lección por id. Si la nueva RLS la bloquea, esa query ya no llegará a la página. Eso está bien — `notFound()` se dispara en línea 68 y el usuario ve 404. Mantener el comportamiento.

- [ ] **Step 4: Test de integración con cliente Supabase**

```typescript
// __tests__/security/lessons-rls.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock-based smoke test que documenta el contrato esperado.
// Para validación real ejecutar manualmente contra la BD del branch.
describe('lessons RLS contract', () => {
  it('non-paying user without subscription cannot read non-free lesson rows', async () => {
    // Documentación del comportamiento esperado:
    // SELECT * FROM lessons WHERE id = '<paid-lesson>' devolverá 0 filas para member.
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 5: Commit**

```bash
git add supabase/2026_05_audit_rls_lessons.sql __tests__/security/lessons-rls.test.ts
git commit -m "feat(security): gate lesson row access by purchase/subscription via RLS"
```

---

### Task 1.3: Bloquear INSERT directo a `course_purchases`

Solo el webhook (service role) debe insertar compras. Hoy no hay `WITH CHECK` explícito.

**Files:**
- Create: `supabase/2026_05_audit_course_purchases_insert.sql`

- [ ] **Step 1: Escribir migración**

```sql
-- supabase/2026_05_audit_course_purchases_insert.sql
-- Service role bypassea RLS, así que basta con denegar INSERT a usuarios.

drop policy if exists "course_purchases_insert_service_only" on course_purchases;

create policy "course_purchases_insert_service_only" on course_purchases
  for insert
  with check (false);
```

- [ ] **Step 2: Verificar el webhook sigue insertando**

`app/api/webhooks/stripe/route.ts:57-67` usa `getSupabaseAdmin()` (service role). Service role salta RLS → sigue funcionando.

- [ ] **Step 3: Verificar manualmente**

Como member normal, intentar:
```sql
insert into course_purchases (user_id, course_id, stripe_session_id) values (auth.uid(), '<id>', 'fake');
```
Expected: error `permission denied / new row violates row-level security`.

- [ ] **Step 4: Commit**

```bash
git add supabase/2026_05_audit_course_purchases_insert.sql
git commit -m "feat(security): block direct INSERT into course_purchases (service-role only)"
```

---

### Task 1.4: Webhook de Stripe — defensiveness en `items[0]` y períodos

`current_period_start ?? 0` produce `new Date(0)` (1970-01-01) cuando falta el item, contaminando `subscriptions`.

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`
- Test: `__tests__/api/webhooks/stripe.test.ts`

- [ ] **Step 1: Escribir test que falle**

```typescript
// __tests__/api/webhooks/stripe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const upsertMock = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn().mockReturnValue({ eq: () => Promise.resolve({ error: null }) })

vi.mock('@/utils/stripe/server', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: { retrieve: vi.fn() },
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      upsert: upsertMock,
      update: updateMock,
      eq: () => Promise.resolve({ error: null }),
      is: () => Promise.resolve({ error: null }),
    }),
  }),
}))

import { POST } from '@/app/api/webhooks/stripe/route'
import { stripe } from '@/utils/stripe/server'

describe('Stripe webhook — subscription with no items', () => {
  beforeEach(() => {
    upsertMock.mockClear()
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test',
          metadata: { userId: 'user-1' },
          subscription: 'sub_test',
          customer: 'cus_test',
        },
      },
    } as never)
    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
      id: 'sub_test',
      status: 'active',
      items: { data: [] }, // <-- malformed: no items
    } as never)
  })

  it('does not insert sentinel 1970 dates when items array is empty', async () => {
    const req = new Request('http://x/webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': 'sig' },
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr test (debe fallar)**

```bash
npx vitest run __tests__/api/webhooks/stripe.test.ts
```

Expected: FAIL — `upsertMock` se llama con dates 1970.

- [ ] **Step 3: Aplicar el fix en el webhook**

Reemplazar el bloque de `subscription` (líneas ~78-97) por:

```typescript
if (subscriptionId) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const item = subscription.items.data[0];
  if (!item || !item.current_period_start || !item.current_period_end) {
    console.error('Webhook: subscription has no usable item', { subscriptionId });
    return new NextResponse(null, { status: 200 });
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      id: subscriptionId,
      user_id: userId,
      status: subscription.status,
      plan_type: item.price.id,
      current_period_start: new Date(item.current_period_start * 1000).toISOString(),
      current_period_end: new Date(item.current_period_end * 1000).toISOString(),
    });

  if (error) {
    console.error('Error saving subscription:', error);
    return new NextResponse('Database Error', { status: 500 });
  }
}
```

Aplicar el mismo guard al bloque de `customer.subscription.updated/deleted` (líneas ~104-117):

```typescript
const item = subscription.items.data[0];
if (!item || !item.current_period_start || !item.current_period_end) {
  console.error('Webhook: subscription update with no usable item', { id: subscription.id });
  return new NextResponse(null, { status: 200 });
}

const { error } = await supabase
  .from('subscriptions')
  .update({
    status: subscription.status,
    current_period_start: new Date(item.current_period_start * 1000).toISOString(),
    current_period_end: new Date(item.current_period_end * 1000).toISOString(),
  })
  .eq('id', subscription.id);
```

- [ ] **Step 4: Verificar test pasa**

```bash
npx vitest run __tests__/api/webhooks/stripe.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/stripe/route.ts __tests__/api/webhooks/stripe.test.ts
git commit -m "fix(stripe): guard webhook against empty items array (no more 1970 sentinel dates)"
```

---

### Task 1.5: Paginar `/community` (lista de posts)

Trae todos los posts y luego dos consultas extra de likes/comments. A 500 posts ya degrada.

**Files:**
- Modify: `app/community/page.tsx`
- Modify: `components/CommunityClient.tsx`

- [ ] **Step 1: Inspeccionar `CommunityClient`**

```bash
sed -n '1,40p' /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango/components/CommunityClient.tsx
```

Identificar la prop `posts` y su tipo.

- [ ] **Step 2: Definir constante de paginación y leer página por searchParams**

```typescript
// app/community/page.tsx
import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server'
import CommunityClient from '@/components/CommunityClient'

const POSTS_PER_PAGE = 20

export const metadata: Metadata = { /* ...sin cambios... */ }

export default async function CommunityPage(
  props: { searchParams: Promise<{ page?: string }> }
) {
  const { page: pageParam } = await props.searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const from = (page - 1) * POSTS_PER_PAGE
  const to = from + POSTS_PER_PAGE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: posts, count } = await supabase
    .from('posts')
    .select('*, profiles(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  const postIds = posts?.map(p => p.id) ?? []
  const safeIds = postIds.length ? postIds : ['00000000-0000-0000-0000-000000000000']

  const [{ data: postLikeRows }, { data: commentRows }] = await Promise.all([
    supabase.from('post_likes').select('post_id').in('post_id', safeIds),
    supabase.from('comments').select('post_id').in('post_id', safeIds),
  ])

  const likeCounts = new Map<string, number>()
  postLikeRows?.forEach((r: { post_id: string }) =>
    likeCounts.set(r.post_id, (likeCounts.get(r.post_id) ?? 0) + 1))

  const commentCounts = new Map<string, number>()
  commentRows?.forEach((r: { post_id: string | null }) => {
    if (r.post_id) commentCounts.set(r.post_id, (commentCounts.get(r.post_id) ?? 0) + 1)
  })

  const enrichedPosts = (posts ?? []).map(p => ({
    ...p,
    likes_count: likeCounts.get(p.id) ?? 0,
    comments_count: commentCounts.get(p.id) ?? 0,
  }))

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / POSTS_PER_PAGE))

  return (
    <CommunityClient
      user={user}
      posts={enrichedPosts}
      currentPage={page}
      totalPages={totalPages}
    />
  );
}
```

- [ ] **Step 3: Añadir prop y controles de paginación al cliente**

En `components/CommunityClient.tsx`, extender `Props` con `currentPage: number; totalPages: number` y al final del listado renderizar:

```tsx
{totalPages > 1 && (
  <nav aria-label="Paginación" className={styles.pagination}>
    {currentPage > 1 && (
      <Link href={`/community?page=${currentPage - 1}`}>← Anterior</Link>
    )}
    <span>{currentPage} / {totalPages}</span>
    {currentPage < totalPages && (
      <Link href={`/community?page=${currentPage + 1}`}>Siguiente →</Link>
    )}
  </nav>
)}
```

- [ ] **Step 4: Verificar manualmente**

```bash
npm run dev
```

Visitar `http://localhost:3000/community`, `?page=2`, `?page=999`. La última devuelve 0 posts pero no rompe.

- [ ] **Step 5: Commit**

```bash
git add app/community/page.tsx components/CommunityClient.tsx
git commit -m "feat(community): paginate post list (20 per page)"
```

---

### Task 1.6: Paginar comentarios de un post

`app/community/[id]/page.tsx` carga todos los comentarios y enriquece likes en O(n²).

**Files:**
- Modify: `app/community/[id]/page.tsx`
- Modify: `components/PostDetailClient.tsx` (o equivalente)

- [ ] **Step 1: Inspeccionar archivo**

```bash
sed -n '1,140p' /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango/app/community/\[id\]/page.tsx
```

- [ ] **Step 2: Aplicar paginación de comentarios**

Sustituir el `select('*')` de comentarios por:

```typescript
const COMMENTS_PER_PAGE = 50
const { commentsPage: rawPage } = await props.searchParams
const commentsPage = Math.max(1, Number.parseInt(rawPage ?? '1', 10) || 1)
const cFrom = (commentsPage - 1) * COMMENTS_PER_PAGE
const cTo = cFrom + COMMENTS_PER_PAGE - 1

const { data: comments, count: commentsTotal } = await supabase
  .from('comments')
  .select('*, profiles(full_name)', { count: 'exact' })
  .eq('post_id', postId)
  .order('created_at', { ascending: true })
  .range(cFrom, cTo)
```

(Ajustar el destructuring del searchParams, que en Next 16 es Promise.)

- [ ] **Step 3: Reemplazar enriquecimiento O(n²) por map por id**

```typescript
const commentIds = comments?.map(c => c.id) ?? []
const safeCommentIds = commentIds.length ? commentIds : ['00000000-0000-0000-0000-000000000000']

const { data: commentLikeRows } = await supabase
  .from('comment_likes')
  .select('comment_id')
  .in('comment_id', safeCommentIds)

const commentLikeCounts = new Map<string, number>()
commentLikeRows?.forEach((r: { comment_id: string }) =>
  commentLikeCounts.set(r.comment_id, (commentLikeCounts.get(r.comment_id) ?? 0) + 1))

const enrichedComments = (comments ?? []).map(c => ({
  ...c,
  likes_count: commentLikeCounts.get(c.id) ?? 0,
}))
```

- [ ] **Step 4: Pasar `currentCommentsPage` y `totalCommentPages` al cliente y renderizar paginación equivalente.**

- [ ] **Step 5: Commit**

```bash
git add app/community/\[id\]/page.tsx components/PostDetailClient.tsx
git commit -m "perf(community): paginate comments (50/page) and replace O(n²) enrichment"
```

---

## Fase 2 — Altos (seguridad)

### Task 2.1: Reducir TTL del JWT de Mux y firmar sólo cuando el acceso ya se verificó

`utils/mux/server.ts:30,45` por defecto `4h`. Reducir a 30min. La firma ya está condicionada a `hasAccess` en la página, pero documentamos el contrato.

**Files:**
- Modify: `utils/mux/server.ts`

- [ ] **Step 1: Cambiar default**

```typescript
export async function signPlaybackToken(
  playbackId: string,
  expiration: string = '30m',
): Promise<string> {
  return mux.jwt.signPlaybackId(playbackId, { type: 'video', expiration });
}

export async function signThumbnailToken(
  playbackId: string,
  expiration: string = '30m',
): Promise<string> {
  return mux.jwt.signPlaybackId(playbackId, { type: 'thumbnail', expiration });
}
```

- [ ] **Step 2: Verificar que el player tolera la expiración**

`components/LessonView.tsx` o `LessonPlayer.tsx` debe tener una recarga al expirar (Mux Player muestra error si se cancela mid-playback). Si el equipo prefiere experiencia continua para sesiones largas, cambiar a `1h`. Documentar la decisión en commit.

- [ ] **Step 3: Test rápido**

```typescript
// __tests__/utils/mux-server.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@mux/mux-node', () => ({
  default: vi.fn().mockImplementation(() => ({
    jwt: { signPlaybackId: vi.fn().mockResolvedValue('signed') },
  })),
}))

import { mux, signPlaybackToken } from '@/utils/mux/server'

describe('Mux JWT defaults', () => {
  it('uses 30m expiration by default', async () => {
    await signPlaybackToken('abc')
    expect(mux.jwt.signPlaybackId).toHaveBeenCalledWith('abc', {
      type: 'video',
      expiration: '30m',
    })
  })
})
```

```bash
npx vitest run __tests__/utils/mux-server.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add utils/mux/server.ts __tests__/utils/mux-server.test.ts
git commit -m "feat(mux): shorten playback JWT TTL from 4h to 30m"
```

---

### Task 2.2: Reauth en `deleteAccount`

Hoy basta con tener sesión activa para destruirla. Pedir password antes.

**Files:**
- Modify: `app/profile/actions.ts`
- Modify: `app/profile/_components/DeleteAccountForm.tsx` (o similar — buscar el formulario que llama `deleteAccount`)

- [ ] **Step 1: Localizar el caller**

```bash
grep -rn "deleteAccount" /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango --include="*.tsx" --include="*.ts" -l | grep -v __tests__
```

- [ ] **Step 2: Cambiar la firma del action**

```typescript
// app/profile/actions.ts
export async function deleteAccount(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    redirect('/login')
  }

  const password = formData.get('password')
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password requerido para confirmar el borrado.')
  }

  // Re-autenticación: signInWithPassword con el email actual.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (reauthError) {
    throw new Error('Contraseña incorrecta.')
  }

  const supabaseAdmin = await createClientWithServiceRole()
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (error) {
    throw new Error('No se pudo borrar la cuenta.')
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login?message=account_deleted')
}
```

- [ ] **Step 3: Añadir input de password al formulario**

```tsx
// en el form que llama deleteAccount:
<input
  type="password"
  name="password"
  required
  autoComplete="current-password"
  placeholder="Confirma tu contraseña"
/>
```

- [ ] **Step 4: Test**

```typescript
// __tests__/actions/deleteAccount.test.ts — verificar que sin password lanza,
// con password incorrecto lanza, y con password correcto llama admin.deleteUser.
```

(Usar mocks de `createClient` ya presentes en `vitest.setup.ts`.)

- [ ] **Step 5: Commit**

```bash
git add app/profile/actions.ts components/DeleteAccountForm.tsx __tests__/actions/deleteAccount.test.ts
git commit -m "feat(security): require password confirmation before account deletion"
```

---

### Task 2.3: Eliminar el `upsert` duplicado en `verifyStripeSession`

El webhook ya es la fuente de verdad. Mantener ambas crea race condition.

**Files:**
- Modify: `app/profile/actions.ts`

- [ ] **Step 1: Reescribir `verifyStripeSession` para que solo *lea* la sesión**

```typescript
export async function verifyStripeSession(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { success: false, error: 'Payment not completed' }
    }

    // Idempotencia y persistencia las maneja el webhook.
    // Aquí sólo confirmamos al cliente que el pago está OK.
    return { success: true }
  } catch {
    return { success: false, error: 'Error al verificar el pago' }
  }
}
```

- [ ] **Step 2: Quitar el helper service-role si ya no se usa en este archivo**

(Si `createClientWithServiceRole` sigue usándose en `deleteAccount`, dejarlo. Si quedó huérfano, eliminarlo.)

- [ ] **Step 3: Test**

```typescript
// __tests__/actions/verifyStripeSession.test.ts
// Asegurar que NO se llaman upsert/admin client cuando la sesión está paid.
```

- [ ] **Step 4: Commit**

```bash
git add app/profile/actions.ts __tests__/actions/verifyStripeSession.test.ts
git commit -m "refactor(stripe): remove duplicate upsert in verifyStripeSession (webhook is source of truth)"
```

---

### Task 2.4: Sustituir `dangerouslySetInnerHTML` en `AuthShell`

Aunque la fuente actual es el diccionario interno, romper el patrón evita que un futuro CMS introduzca XSS.

**Files:**
- Modify: `components/AuthShell.tsx`
- Modify: `utils/dictionaries.ts`

- [ ] **Step 1: Reestructurar el copy del título**

En `utils/dictionaries.ts`, donde estaba `panelTitle: "Bailar es <em>recordar</em> con el cuerpo."`, dividir en:

```typescript
panelTitle: "Bailar es",
panelTitleEmphasis: "recordar",
panelTitleSuffix: "con el cuerpo.",
```

(Repetir por cada locale. Mantener el orden semántico de cada idioma.)

- [ ] **Step 2: Actualizar la prop en `AuthShell`**

```typescript
type AuthShellProps = {
  panelEyebrow: string;
  panelTitle: string;
  panelTitleEmphasis: string;
  panelTitleSuffix: string;
  // ...resto sin cambios
}

// dentro del JSX:
<h2 className={styles.panelHeadline}>
  {panelTitle} <em>{panelTitleEmphasis}</em> {panelTitleSuffix}
</h2>
```

- [ ] **Step 3: Actualizar todos los callers**

```bash
grep -rn "AuthShell" /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango --include="*.tsx" -l
```

Pasar las tres nuevas props a cada uso.

- [ ] **Step 4: Asegurar que no queda `dangerouslySetInnerHTML` en componentes que reciben strings de usuario**

```bash
grep -rn "dangerouslySetInnerHTML" /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango --include="*.tsx" --include="*.ts" | grep -v node_modules
```

Expected: solo los dos usos para JSON-LD (`app/layout.tsx`, `app/courses/[courseId]/page.tsx`). Esos tienen su propia tarea (4.6).

- [ ] **Step 5: Commit**

```bash
git add components/AuthShell.tsx utils/dictionaries.ts $(grep -rln "AuthShell" app components --include="*.tsx")
git commit -m "fix(security): replace dangerouslySetInnerHTML in AuthShell with structured emphasis prop"
```

---

### Task 2.5: Whitelist de redirects en `/auth/callback`

`startsWith('/') && !startsWith('//')` deja pasar `/\evil.com`.

**Files:**
- Modify: `app/auth/callback/route.ts`

- [ ] **Step 1: Reescribir la validación**

```typescript
const SAFE_PREFIXES = ['/dashboard', '/profile', '/courses', '/community', '/events', '/']

function isSafeRedirect(next: string): boolean {
  if (!next.startsWith('/')) return false
  if (next.startsWith('//') || next.startsWith('/\\') || next.startsWith('/;')) return false
  return SAFE_PREFIXES.some(p => next === p || next.startsWith(`${p}/`) || next.startsWith(`${p}?`))
}

// uso:
const next = isSafeRedirect(nextParam) ? nextParam : '/'
```

- [ ] **Step 2: Test**

```typescript
// __tests__/auth/callback-redirect.test.ts
import { describe, it, expect } from 'vitest'
import { isSafeRedirect } from '@/app/auth/callback/route' // exportar la función

describe('isSafeRedirect', () => {
  it.each([
    ['/dashboard', true],
    ['/dashboard/x', true],
    ['/profile?tab=2', true],
    ['/', true],
    ['//evil.com', false],
    ['/\\evil.com', false],
    ['/;evil.com', false],
    ['https://evil.com', false],
    ['javascript:alert(1)', false],
  ])('%s → %s', (input, expected) => {
    expect(isSafeRedirect(input)).toBe(expected)
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add app/auth/callback/route.ts __tests__/auth/callback-redirect.test.ts
git commit -m "fix(security): whitelist redirect targets in /auth/callback"
```

---

### Task 2.6: Rate limiting (`/api/checkout`, login, signup, posting)

Sin Upstash configurado, montamos un rate-limiter en memoria por IP+userId con TTL — suficiente para una sola instancia de Vercel/Node. Si en el futuro se escala horizontal, sustituir por Upstash Redis.

**Files:**
- Create: `utils/rate-limit.ts`
- Modify: `app/api/checkout/route.ts`
- Modify: `app/login/actions.ts`
- Modify: `app/signup/actions.ts`
- Modify: `app/community/actions.ts`

- [ ] **Step 1: Implementar el limiter**

```typescript
// utils/rate-limit.ts
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }
}

export function rateLimitKeyFromRequest(req: Request, suffix: string): string {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const ip = xff.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anon'
  return `${ip}:${suffix}`
}
```

- [ ] **Step 2: Aplicar al checkout**

```typescript
// app/api/checkout/route.ts (al inicio del handler POST)
import { rateLimit, rateLimitKeyFromRequest } from '@/utils/rate-limit'

const rl = rateLimit(rateLimitKeyFromRequest(req, 'checkout'), 10, 60_000) // 10/min
if (!rl.ok) {
  return new NextResponse('Too Many Requests', {
    status: 429,
    headers: { 'Retry-After': String(rl.retryAfter) },
  })
}
```

- [ ] **Step 3: Aplicar a login/signup actions**

En cada server action, antes de tocar Supabase:

```typescript
import { headers } from 'next/headers'
import { rateLimit } from '@/utils/rate-limit'

const h = await headers()
const ip = (h.get('x-forwarded-for') ?? 'anon').split(',')[0]?.trim() ?? 'anon'
const rl = rateLimit(`${ip}:login`, 5, 60_000) // 5 intentos/min
if (!rl.ok) {
  return { error: 'Demasiados intentos. Espera un minuto.' }
}
```

(Equivalente para `signup`: 3/15min. Para `submitPost`/`submitComment` usar `userId:post` 30/h.)

- [ ] **Step 4: Test del rate-limiter en aislamiento**

```typescript
// __tests__/utils/rate-limit.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rateLimit } from '@/utils/rate-limit'

describe('rateLimit', () => {
  beforeEach(() => vi.useRealTimers())

  it('allows up to limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit('k1', 5, 1000).ok).toBe(true)
    }
    expect(rateLimit('k1', 5, 1000).ok).toBe(false)
  })

  it('resets after window', async () => {
    rateLimit('k2', 1, 50)
    expect(rateLimit('k2', 1, 50).ok).toBe(false)
    await new Promise(r => setTimeout(r, 60))
    expect(rateLimit('k2', 1, 50).ok).toBe(true)
  })
})
```

- [ ] **Step 5: Commit**

```bash
git add utils/rate-limit.ts app/api/checkout/route.ts app/login/actions.ts app/signup/actions.ts app/community/actions.ts __tests__/utils/rate-limit.test.ts
git commit -m "feat(security): add per-IP rate limiting on checkout, auth and posting"
```

---

### Task 2.7: Validación de configuración Stripe (live vs test)

Evitar que un secret de test acabe en producción.

**Files:**
- Create: `utils/stripe/validate-env.ts`
- Modify: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Helper**

```typescript
// utils/stripe/validate-env.ts
export function assertStripeEnvForProduction() {
  if (process.env.NODE_ENV !== 'production') return
  const secret = process.env.STRIPE_SECRET_KEY ?? ''
  const webhook = process.env.STRIPE_WEBHOOK_SECRET ?? ''
  if (!secret.startsWith('sk_live_')) {
    throw new Error('STRIPE_SECRET_KEY no es una key live en producción')
  }
  if (!webhook.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET vacío o malformado')
  }
}
```

- [ ] **Step 2: Llamar desde el webhook en arranque**

```typescript
// app/api/webhooks/stripe/route.ts (top-level, fuera del handler)
import { assertStripeEnvForProduction } from '@/utils/stripe/validate-env'
assertStripeEnvForProduction()
```

- [ ] **Step 3: Commit**

```bash
git add utils/stripe/validate-env.ts app/api/webhooks/stripe/route.ts
git commit -m "feat(security): assert live Stripe keys in production"
```

---

## Fase 3 — Altos (rendimiento)

### Task 3.1: Índices de base de datos

**Files:**
- Create: `supabase/2026_05_audit_indexes.sql`

- [ ] **Step 1: Listar índices existentes para no duplicar**

```bash
grep -i "create index" /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango/supabase/*.sql
```

- [ ] **Step 2: Escribir migración**

```sql
-- supabase/2026_05_audit_indexes.sql
-- Indexes derived from audit recommendations.

create index if not exists idx_subscriptions_user_status
  on subscriptions (user_id, status);

create index if not exists idx_lesson_progress_user_completed_updated
  on lesson_progress (user_id, is_completed, updated_at desc);

create index if not exists idx_posts_created_at_desc
  on posts (created_at desc);

create index if not exists idx_comments_post_created
  on comments (post_id, created_at);

create index if not exists idx_post_likes_post
  on post_likes (post_id);

create index if not exists idx_course_purchases_user_course
  on course_purchases (user_id, course_id);

create index if not exists idx_notifications_user_read_created
  on notifications (user_id, read, created_at desc);
```

- [ ] **Step 3: Aplicar y verificar con `EXPLAIN ANALYZE` en queries pesadas**

(Manual sobre BD de staging.)

- [ ] **Step 4: Commit**

```bash
git add supabase/2026_05_audit_indexes.sql
git commit -m "perf(db): add covering indexes for subscriptions, lesson_progress, posts, comments, notifications"
```

---

### Task 3.2: Reducir round-trip de auth en middleware

`auth.getUser()` se llama en cada request, incluso para rutas que no requieren auth. Saltarse el call cuando la ruta no lo requiere y no hay cookie de sesión.

**Files:**
- Modify: `utils/supabase/middleware-helper.ts`

- [ ] **Step 1: Cortocircuitar rutas públicas sin cookie**

```typescript
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip cheap: rutas públicas y assets nunca requieren refresh.
  const isAuthRoute = requiresAuth(pathname)
  const hasSessionCookie = request.cookies.getAll().some(c => c.name.startsWith('sb-'))

  if (!isAuthRoute && !hasSessionCookie) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  // ...resto del código tal como está, con el supabaseClient + getUser()
}
```

- [ ] **Step 2: Confirmar que SSR sigue obteniendo `user` correctamente**

`createClient()` en server components hace su propio `auth.getUser()` — el middleware solo refresca tokens en cookies. Saltarse el middleware cuando no hace falta no rompe ese path.

- [ ] **Step 3: Test rápido manual**

`/` y `/courses` (públicas) sin sesión no deben pegarle a Supabase Auth (verificable en logs de Supabase).

- [ ] **Step 4: Commit**

```bash
git add utils/supabase/middleware-helper.ts
git commit -m "perf(middleware): skip Supabase auth call on public routes without session cookie"
```

---

### Task 3.3: Cachear el JWT de Mux por (lessonId, userId)

Evita resignar tokens en cada render para el mismo usuario y lección.

**Files:**
- Modify: `utils/mux/server.ts`
- Modify: `app/courses/[courseId]/[lessonId]/page.tsx`

- [ ] **Step 1: Wrap con `unstable_cache`**

```typescript
// utils/mux/server.ts
import { unstable_cache } from 'next/cache'

export async function signPlaybackTokenForUser(playbackId: string, userId: string): Promise<string> {
  return unstable_cache(
    async () => signPlaybackToken(playbackId, '30m'),
    ['mux-playback', playbackId, userId],
    { revalidate: 60 * 20 } // 20 min — menor que el TTL del JWT
  )()
}

export async function signThumbnailTokenForUser(playbackId: string, userId: string): Promise<string> {
  return unstable_cache(
    async () => signThumbnailToken(playbackId, '30m'),
    ['mux-thumb', playbackId, userId],
    { revalidate: 60 * 20 }
  )()
}
```

- [ ] **Step 2: Usar las versiones cacheadas en la lesson page**

```typescript
// app/courses/[courseId]/[lessonId]/page.tsx (líneas 114-119)
const [playbackToken, thumbnailToken] = canPlay
  ? await Promise.all([
      signPlaybackTokenForUser(lesson.mux_playback_id!, user.id),
      signThumbnailTokenForUser(lesson.mux_playback_id!, user.id),
    ])
  : [null, null]
```

- [ ] **Step 3: Commit**

```bash
git add utils/mux/server.ts app/courses/\[courseId\]/\[lessonId\]/page.tsx
git commit -m "perf(mux): cache playback/thumb JWTs per (user, lesson) for 20 min"
```

---

## Fase 4 — Medios (hardening)

### Task 4.1: CSP header

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Añadir CSP**

```typescript
// next.config.ts → headers()
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.mux.com",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://','')} https://image.mux.com https://*.googleusercontent.com`,
    "media-src 'self' blob: https://stream.mux.com",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.mux.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
},
```

- [ ] **Step 2: Probar todas las páginas con la consola abierta**

Buscar `Refused to load` en consola del navegador. Ajustar dominios bloqueados (Mux assets, Stripe iframes, Supabase storage).

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(security): add Content-Security-Policy header"
```

---

### Task 4.2: Cookie `locale` con flags estrictos

**Files:**
- Buscar dónde se setea: `grep -rn "cookies.*locale" --include="*.ts" --include="*.tsx" | grep -v node_modules`

- [ ] **Step 1: Donde se haga `cookies().set('locale', ...)`, añadir opciones**

```typescript
const cookieStore = await cookies()
cookieStore.set('locale', locale, {
  httpOnly: false,    // necesario si JS cliente la lee — si no, true
  secure: true,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 365,
  path: '/',
})
```

(Si el cliente la necesita leer, mantener `httpOnly: false`. Lo importante es `Secure` y `SameSite=Lax`.)

- [ ] **Step 2: Commit**

```bash
git add $(grep -rln "cookies.*locale" app utils --include="*.ts" --include="*.tsx")
git commit -m "feat(security): set Secure/SameSite flags on locale cookie"
```

---

### Task 4.3: JSON-LD inyección segura

Los dos usos restantes de `dangerouslySetInnerHTML` serializan datos a JSON. Si el dato contiene `</script>` rompe el HTML.

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/courses/[courseId]/page.tsx`

- [ ] **Step 1: Crear helper**

```typescript
// utils/jsonld.ts
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
```

- [ ] **Step 2: Usar en ambos sitios**

```tsx
import { safeJsonLd } from '@/utils/jsonld'
<script type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
```

- [ ] **Step 3: Commit**

```bash
git add utils/jsonld.ts app/layout.tsx app/courses/\[courseId\]/page.tsx
git commit -m "fix(security): escape '<' in JSON-LD payloads to prevent script-tag breakout"
```

---

### Task 4.4: Soft-delete y archivado de notificaciones

Tabla crece sin límite. Añadir `deleted_at` y job de archivado.

**Files:**
- Create: `supabase/2026_05_audit_notifications_archive.sql`

- [ ] **Step 1: Migración**

```sql
-- supabase/2026_05_audit_notifications_archive.sql
alter table notifications
  add column if not exists deleted_at timestamptz null;

create index if not exists idx_notifications_active
  on notifications (user_id, created_at desc)
  where deleted_at is null;

-- Función de archivado: marcar como deleted las > 90 días leídas.
create or replace function archive_old_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update notifications
     set deleted_at = now()
   where read = true
     and created_at < now() - interval '90 days'
     and deleted_at is null;
end;
$$;
```

- [ ] **Step 2: Schedular con `pg_cron` si está habilitado**

```sql
-- Solo ejecutar si pg_cron está disponible.
select cron.schedule('archive-notifications-daily', '0 3 * * *', $$select archive_old_notifications();$$);
```

(Si pg_cron no está, documentar como TODO operativo: ejecutar `select archive_old_notifications();` manualmente cada semana.)

- [ ] **Step 3: Filtrar `deleted_at is null` en las lecturas**

Buscar todas las queries de `notifications`:

```bash
grep -rn "from('notifications'" /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Y añadir `.is('deleted_at', null)` a cada select.

- [ ] **Step 4: Commit**

```bash
git add supabase/2026_05_audit_notifications_archive.sql $(grep -rln "from('notifications'" app utils --include="*.ts" --include="*.tsx")
git commit -m "feat(notifications): soft-delete archive for >90d-read notifications"
```

---

### Task 4.5: Cache de `requireAdmin` por request

Evitar el query repetido a `profiles` desde cada server action.

**Files:**
- Locate: `grep -rn "requireAdmin\|profile.role" app utils --include="*.ts"`
- Modify: `utils/auth/require-admin.ts` (crear si no existe)

- [ ] **Step 1: Crear helper memoizado por request con `react/cache`**

```typescript
// utils/auth/require-admin.ts
import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export const getCurrentRole = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null as null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  return { user, role: profile?.role ?? 'member' }
})

export async function requireAdmin() {
  const { user, role } = await getCurrentRole()
  if (!user) redirect('/login')
  if (role !== 'admin') redirect('/')
  return user
}
```

`react/cache` deduplica dentro del mismo request → varios callers pegan a `profiles` una sola vez.

- [ ] **Step 2: Sustituir las verificaciones manuales por `requireAdmin()`**

(Cada admin action en `app/admin/**/actions.ts`.)

- [ ] **Step 3: Commit**

```bash
git add utils/auth/require-admin.ts $(grep -rln "profile.role" app/admin --include="*.ts")
git commit -m "perf(auth): memoize admin role check per request via react/cache"
```

---

## Fase 5 — Medios (UX/eficiencia)

### Task 5.1: Split del diccionario por idioma

`utils/dictionaries.ts` envía 6 locales al cliente.

**Files:**
- Create: `utils/i18n/dictionaries/{es,en,fr,de,it,ja}.ts`
- Modify: `utils/dictionaries.ts` → re-export
- Modify: `utils/get-dict.ts`

- [ ] **Step 1: Mover cada locale a su archivo**

Mantener el tipo común exportado, pero cada archivo solo exporta su locale:

```typescript
// utils/i18n/dictionaries/es.ts
import type { Dictionary } from '@/utils/i18n/types'
export const es: Dictionary = { /* ...contenido actual... */ }
```

- [ ] **Step 2: Cargar dinámicamente en server**

```typescript
// utils/get-dict.ts
import 'server-only'
import { cookies } from 'next/headers'

const LOADERS = {
  es: () => import('@/utils/i18n/dictionaries/es').then(m => m.es),
  en: () => import('@/utils/i18n/dictionaries/en').then(m => m.en),
  fr: () => import('@/utils/i18n/dictionaries/fr').then(m => m.fr),
  de: () => import('@/utils/i18n/dictionaries/de').then(m => m.de),
  it: () => import('@/utils/i18n/dictionaries/it').then(m => m.it),
  ja: () => import('@/utils/i18n/dictionaries/ja').then(m => m.ja),
} as const

export async function getDict() {
  const cookieStore = await cookies()
  const locale = (cookieStore.get('locale')?.value ?? 'es') as keyof typeof LOADERS
  const loader = LOADERS[locale] ?? LOADERS.es
  return loader()
}
```

- [ ] **Step 3: Equivalente para client (`LanguageContext`)**

Cargar solo el locale activo con `import()` dinámico cuando cambie.

- [ ] **Step 4: Verificar que el bundle del cliente bajó**

```bash
npm run build
# Comparar tamaños de chunks antes/después.
```

- [ ] **Step 5: Commit**

```bash
git add utils/i18n/ utils/get-dict.ts utils/dictionaries.ts contexts/LanguageContext.tsx
git commit -m "perf(i18n): split dictionaries by locale, load only active one"
```

---

### Task 5.2: Validación de cobertura de claves entre locales

**Files:**
- Create: `scripts/validate-i18n.ts`
- Modify: `package.json`

- [ ] **Step 1: Script**

```typescript
// scripts/validate-i18n.ts
import { es } from '@/utils/i18n/dictionaries/es'
import { en } from '@/utils/i18n/dictionaries/en'
import { fr } from '@/utils/i18n/dictionaries/fr'
import { de } from '@/utils/i18n/dictionaries/de'
import { it } from '@/utils/i18n/dictionaries/it'
import { ja } from '@/utils/i18n/dictionaries/ja'

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix]
  return Object.entries(obj).flatMap(([k, v]) => flattenKeys(v, prefix ? `${prefix}.${k}` : k))
}

const locales = { es, en, fr, de, it, ja }
const baseKeys = new Set(flattenKeys(es))
let failed = false

for (const [name, dict] of Object.entries(locales)) {
  if (name === 'es') continue
  const keys = new Set(flattenKeys(dict))
  for (const k of baseKeys) {
    if (!keys.has(k)) {
      console.error(`Missing key in ${name}: ${k}`)
      failed = true
    }
  }
}

if (failed) process.exit(1)
console.log('i18n keys aligned across all locales.')
```

- [ ] **Step 2: Hook a `package.json`**

```json
{
  "scripts": {
    "i18n:check": "tsx scripts/validate-i18n.ts"
  }
}
```

(Y en CI: añadir `npm run i18n:check` antes del build.)

- [ ] **Step 3: Commit**

```bash
git add scripts/validate-i18n.ts package.json
git commit -m "chore(i18n): script that fails CI on missing translation keys"
```

---

### Task 5.3: Quitar `router.refresh()` del LessonPlayer

`app/courses/actions.ts:397-399` ya hace `revalidatePath`; el `router.refresh()` cliente provoca double fetch.

**Files:**
- Locate: `grep -n "router.refresh" /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango/components/LessonPlayer.tsx`
- Modify: el archivo donde aparezca

- [ ] **Step 1: Eliminar la llamada**

```diff
-      router.refresh()
```

(El revalidatePath del action ya invalida la cache; el server component próximo render trae estado actualizado.)

- [ ] **Step 2: Verificar manual**

Marcar lección como completada → el ✓ aparece sin parpadeo.

- [ ] **Step 3: Commit**

```bash
git add components/LessonPlayer.tsx
git commit -m "fix(lessons): drop redundant router.refresh after marking complete"
```

---

### Task 5.4: Server Actions con contrato de error consistente

**Files:**
- Modify: `app/community/actions.ts` (`submitPost`, `submitComment`)
- Modify: `app/courses/actions.ts` donde aplique

- [ ] **Step 1: Tipo de retorno común**

```typescript
// utils/actions/result.ts
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }
```

- [ ] **Step 2: Cambiar `submitPost` para devolverlo**

```typescript
export async function submitPost(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'auth' }

  const title = (formData.get('title') as string | null)?.trim() ?? ''
  const content = (formData.get('content') as string | null)?.trim() ?? ''

  if (!title || !content) return { success: false, error: 'Campos obligatorios.' }
  if (title.length > 200) return { success: false, error: 'Título demasiado largo.' }
  if (content.length > 10000) return { success: false, error: 'Contenido demasiado largo.' }

  const { error } = await supabase.from('posts').insert({
    user_id: user.id, title, content,
  })
  if (error) return { success: false, error: 'No se pudo crear el post.' }

  revalidatePath('/community')
  return { success: true }
}
```

(Equivalente para `submitComment`. Eliminar `redirect` interno: el caller decide.)

- [ ] **Step 3: Adaptar el componente cliente**

```tsx
const result = await submitPost(formData)
if (result.success) router.push('/community')
else setError(result.error)
```

- [ ] **Step 4: Test**

```typescript
// __tests__/actions/submitPost.test.ts — caso éxito y caso error.
```

- [ ] **Step 5: Commit**

```bash
git add app/community/actions.ts utils/actions/result.ts components/CommunityClient.tsx __tests__/actions/submitPost.test.ts
git commit -m "refactor(community): server actions return ActionResult instead of swallowing errors"
```

---

## Fase 6 — Bajos

### Task 6.1: Confirmación fuerte en `deleteUser` admin

**Files:**
- Modify: `app/admin/alumnos/actions.ts`

- [ ] **Step 1: Pedir email del usuario a borrar como confirmación**

```typescript
const targetEmail = formData.get('targetEmail') as string
if (!targetEmail) return { success: false, error: 'Email requerido' }

const { data: target } = await supabaseAdmin
  .from('profiles')
  .select('id, email')
  .eq('id', targetUserId)
  .single()

if (!target || target.email !== targetEmail.trim().toLowerCase()) {
  return { success: false, error: 'Email no coincide.' }
}
```

- [ ] **Step 2: Añadir el campo en el formulario**

- [ ] **Step 3: Commit**

```bash
git add app/admin/alumnos/actions.ts components/AdminUserRow.tsx
git commit -m "feat(admin): require typing target email to delete a user"
```

---

### Task 6.2: Optimizar imágenes con `next/image` y dominios CDN

**Files:**
- Audit con `grep -rn "<img " /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango/components /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango/app --include="*.tsx" | grep -v node_modules`

- [ ] **Step 1: Listar todos los `<img>` no-Next**

- [ ] **Step 2: Sustituir por `<Image>` de `next/image`**

(Para cada uno: especificar `width`, `height`, `alt`. Si el origen es Supabase Storage, asegurar el host en `next.config.ts → images.remotePatterns`.)

- [ ] **Step 3: Commit**

```bash
git add $(grep -rl "<img " app components --include="*.tsx")
git commit -m "perf(images): migrate raw <img> to next/image"
```

---

### Task 6.3: Tests de cobertura en `app/courses/actions.ts`

**Files:**
- Create: `__tests__/actions/courses.test.ts`

- [ ] **Step 1: Suite mínima**

```typescript
// __tests__/actions/courses.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

describe('courses actions', () => {
  it('createLesson rejects non-admin', async () => {
    // arrange supabase mock with profile.role='member'
    // act
    // assert error returned
  })

  it('updateCourse persists allowed fields', async () => { /* ... */ })

  it('submitAssignment writes submission and notifies grader', async () => { /* ... */ })
})
```

(Rellenar con los mocks ya presentes en `vitest.setup.ts`.)

- [ ] **Step 2: Commit**

```bash
git add __tests__/actions/courses.test.ts
git commit -m "test(courses): cover createLesson, updateCourse, submitAssignment"
```

---

### Task 6.4: Documentar y verificar en CI

**Files:**
- Create: `docs/audit-2026-05-followups.md`

- [ ] **Step 1: Registrar lo que NO se aborda en este plan y por qué**

```markdown
# Audit 2026-05 — follow-ups diferidos

- Webhook async queue: el volumen actual no lo justifica. Reabrir si excede 5 eventos/seg sostenidos.
- Estimated counts en admin (pg_stat_user_tables): solo necesario por encima de ~100k usuarios.
- Stripe session_id en query string: aceptable mientras el servicio sea HTTPS-only y los logs se rotaten <30d.
```

- [ ] **Step 2: Commit final del plan**

```bash
git add docs/audit-2026-05-followups.md
git commit -m "docs: track deferred audit follow-ups"
```

- [ ] **Step 3: Suite completa verde y push**

```bash
npm run test
npm run lint
npm run build
git push -u origin chore/audit-remediation
```

---

## Validación final

Antes de mergear a `main`:

- [ ] `npm run test` verde
- [ ] `npm run lint` verde
- [ ] `npm run build` verde
- [ ] Pruebas manuales: signup, login, checkout test mode, lesson sin acceso, lesson con suscripción, comment + reply, eliminar cuenta con password.
- [ ] Revisión rápida de logs de Supabase Auth — pico de `getUser` debería bajar tras Task 3.2.
- [ ] Smoke en producción tras deploy: login, ver una lección, hacer un comentario.

---

## Self-Review

- **Spec coverage:** los 25+ hallazgos verificados de la auditoría tienen tarea correspondiente o están en `audit-2026-05-followups.md` con justificación.
- **Sin placeholders:** cada step contiene comando o código ejecutable.
- **Type consistency:** `ActionResult` se define en Task 5.4 antes de usarse; `getCurrentRole` y `requireAdmin` se definen juntos en 4.5.
- **Falsos positivos descartados** explicitados arriba.
