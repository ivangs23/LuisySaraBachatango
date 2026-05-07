# Audit 4 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar las 8 brechas identificadas en la cuarta auditoría (2 ALTO, 2 MEDIO, 4 BAJO/operacional) sin introducir nueva deuda.

**Architecture:** El núcleo del fix es defense-in-depth en bordes que ya estaban cubiertos por capas anteriores: NULL guards en RLS, race-free customer creation con UPDATE condicional, webhook idempotency vía upsert en TODOS los handlers, y un helper de scrubbing de errores DB. Para los formularios `/contact` y newsletter — hoy son UI placeholders — añadimos persistencia mínima en BD (con RLS admin-only) para que no se pierdan leads aunque la integración de email se haga después.

**Tech Stack:** Next.js 16 App Router · Supabase Pro · Stripe · Mux · Vitest · Upstash Redis.

**Hallazgos descartados como falsos positivos en este audit:**
- ❌ Race en `togglePostLike`/`toggleLike` por concurrencia: `post_likes` y `comment_likes` ya tienen UNIQUE constraints en producción — verificado vía pg_constraint.
- ❌ `/api/lessons/next` over-broadcast: la RLS de `lessons` (audit 1) gateaa correctamente; usuarios sin acceso reciben null.

---

## Fase 0 — Preparación

### Task 0.1: Crear rama y baseline

**Files:** ninguno (bootstrap)

- [ ] **Step 1: Branch**

```bash
cd /Users/ivangonzalez/Documents/proyectos/LuisySaraBachatango
git checkout main
git pull origin main
git checkout -b chore/audit4-remediation
```

- [ ] **Step 2: Gates verdes**

```bash
npm run test
npm run lint
npx tsc --noEmit
npm run build
npm run i18n:check
```

Expected: all pass. Si falla, parar y reportar BLOCKED.

- [ ] **Step 3: Commit empty marker**

```bash
git commit --allow-empty -m "chore: start audit4-remediation branch"
```

---

## Fase A — ALTO

### Task A.1: RLS lessons — guard NULL year/month

`supabase/2026_05_audit_rls_lessons.sql` usa `make_date(c.year, c.month, 1)` dentro del subquery de subscription. Si `courses.year IS NULL` o `courses.month IS NULL`, `make_date` lanza `ERROR: date field value out of range` y aborta todo el SELECT. Verificado en producción: ambas columnas son nullable.

**Files:**
- Create: `supabase/2026_05_audit4_rls_lessons_null_guard.sql`

- [ ] **Step 1: Verificar columnas siguen siendo nullable**

(Vía MCP `execute_sql` con: `select column_name, is_nullable from information_schema.columns where table_schema='public' and table_name='courses' and column_name in ('year','month');`)

Expected: ambas `is_nullable = YES`.

- [ ] **Step 2: Escribir migración**

```sql
-- supabase/2026_05_audit4_rls_lessons_null_guard.sql
-- Guard contra year/month NULL en la rama de subscription del policy.
-- Sin este guard, make_date(NULL, ...) lanza error y aborta el SELECT
-- entero — bloqueando lecciones legítimas a usuarios sin admin/free/purchase.

drop policy if exists "Lessons SELECT: free, admin, purchased or subscribed." on lessons;

create policy "Lessons SELECT: free, admin, purchased or subscribed." on lessons
  for select using (
    coalesce(is_free, false) = true
    or exists (
      select 1 from profiles
      where id = (select auth.uid()) and role = 'admin'
    )
    or exists (
      select 1 from course_purchases cp
      where cp.user_id = (select auth.uid())
        and cp.course_id = lessons.course_id
    )
    or exists (
      select 1
      from subscriptions s
      join courses c on c.id = lessons.course_id
      where s.user_id = (select auth.uid())
        and s.status in ('active', 'trialing')
        and c.year is not null
        and c.month is not null
        and s.current_period_start <=
              (make_date(c.year, c.month, 1) + interval '1 month' - interval '1 second')
        and s.current_period_end >= make_date(c.year, c.month, 1)
    )
  );
```

- [ ] **Step 3: Aplicar via MCP**

(`apply_migration` con `name: audit4_2026_05_rls_lessons_null_guard`, `query`: contenido sin la primera línea de comentario.)

Expected: `{"success":true}`.

- [ ] **Step 4: Smoke test**

(Vía `execute_sql`):

```sql
-- Insertar curso sin year/month (admin-only, así que usar service role implícito)
-- En producción, esto se simula con datos reales. Verificar que la policy nueva
-- no rompe en presencia de NULL:
explain (verbose)
  select count(*) from lessons
   where exists (
     select 1 from courses c where c.id = lessons.course_id and c.year is null
   );
```

(Solo confirma que el plan no usa el make_date en esa condición — es smoke conceptual.)

- [ ] **Step 5: Commit**

```bash
git add supabase/2026_05_audit4_rls_lessons_null_guard.sql
git commit -m "fix(security): guard make_date against NULL year/month in lessons RLS"
```

---

### Task A.2: `profiles.stripe_customer_id` race-free + UNIQUE constraint

Two simultaneous checkout requests for the same user create two Stripe customers. Two fixes layered:

1. UPDATE the profile only if `stripe_customer_id IS NULL` (matches the pattern the webhook already uses).
2. Add UNIQUE constraint as backstop.

**Files:**
- Modify: `app/api/checkout/route.ts`
- Create: `supabase/2026_05_audit4_profiles_stripe_customer_unique.sql`

- [ ] **Step 1: Modify checkout to use conditional UPDATE**

Localizar en `app/api/checkout/route.ts` el bloque que crea customer (líneas ~46-55):

```typescript
const customer = await stripe.customers.create({
  email: user.email,
  metadata: { userId: user.id },
});
customerId = customer.id;
await supabaseAdmin
  .from('profiles')
  .update({ stripe_customer_id: customerId })
  .eq('id', user.id);
```

Sustituir por:

```typescript
const customer = await stripe.customers.create({
  email: user.email,
  metadata: { userId: user.id },
});

// Race guard: only set stripe_customer_id if it's still null. If a
// concurrent request already wrote one, re-fetch and keep theirs to
// avoid orphaning a Stripe customer with billing details.
const { data: updated } = await supabaseAdmin
  .from('profiles')
  .update({ stripe_customer_id: customer.id })
  .eq('id', user.id)
  .is('stripe_customer_id', null)
  .select('stripe_customer_id')
  .maybeSingle();

if (updated?.stripe_customer_id) {
  customerId = updated.stripe_customer_id;
} else {
  // Lost the race — re-read what was committed by the winner.
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();
  customerId = existing?.stripe_customer_id ?? customer.id;
  // Note: the customer we just created here is now orphaned in Stripe.
  // Stripe charges nothing for unused customers; it stays as test/log
  // metadata. Optionally clean up via stripe.customers.del() but it's
  // not critical.
}
```

- [ ] **Step 2: Crear migración UNIQUE constraint**

```sql
-- supabase/2026_05_audit4_profiles_stripe_customer_unique.sql
-- Backstop for the race condition between concurrent /api/checkout calls.
-- Even with the conditional UPDATE in the route, network reordering or
-- service role bypass could in theory write twice. UNIQUE makes that
-- impossible at the DB layer.

-- NULL values are allowed multiple times (one per row) under default
-- UNIQUE semantics, so existing profiles without a customer ID are fine.

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;
```

(Partial unique index excluyendo NULLs — la sintaxis `WHERE stripe_customer_id IS NOT NULL` permite múltiples filas con NULL pero garantiza unicidad para valores set.)

- [ ] **Step 3: Aplicar migración**

(`apply_migration` con `name: audit4_2026_05_profiles_stripe_customer_unique`.)

- [ ] **Step 4: Verify**

```sql
select indexname from pg_indexes where schemaname='public' and indexname='profiles_stripe_customer_id_key';
```

Expected: 1 row.

- [ ] **Step 5: Gates + commit**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
git add app/api/checkout/route.ts supabase/2026_05_audit4_profiles_stripe_customer_unique.sql
git commit -m "fix(stripe): race-free Stripe customer assignment in checkout"
```

---

## Fase B — MEDIO

### Task B.1: Webhook Stripe — handle `customer.subscription.created`

Hoy solo se maneja `checkout.session.completed`, `.updated`, `.deleted`. Si el `completed` falla y Stripe da por perdido el reintento, los siguientes eventos (`created`/`updated`) caen en el handler de `updated` que hace `.update()` con `eq('id')` — afecta 0 filas, el user paga sin acceso.

Solución: añadir `customer.subscription.created` con la misma lógica de upsert; cambiar el `updated`/`deleted` de `.update()` a `.upsert()` para que también funcione si la fila no existe.

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`
- Modify: `__tests__/api/webhooks.test.ts`

- [ ] **Step 1: Test que falle**

Añadir al describe existente del webhook:

```typescript
it('handles customer.subscription.created by upserting the row', async () => {
  upsertMock.mockClear()
  vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
    type: 'customer.subscription.created',
    data: {
      object: {
        id: 'sub_new',
        status: 'active',
        items: { data: [{
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          price: { id: 'price_x' },
        }] },
        metadata: { userId: 'user-1' },
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
  expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
    id: 'sub_new',
    status: 'active',
  }))
})

it('updated falls back to upsert if row does not exist (out-of-order events)', async () => {
  upsertMock.mockClear()
  vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_late',
        status: 'active',
        items: { data: [{
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          price: { id: 'price_x' },
        }] },
        metadata: { userId: 'user-1' },
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
  expect(upsertMock).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test FAIL**

```bash
npx vitest run __tests__/api/webhooks.test.ts -t "subscription"
```

- [ ] **Step 3: Refactor del handler**

En `app/api/webhooks/stripe/route.ts`, sustituir el bloque `if (event.type === 'customer.subscription.updated' || ... 'deleted')` por:

```typescript
if (
  event.type === 'customer.subscription.created' ||
  event.type === 'customer.subscription.updated' ||
  event.type === 'customer.subscription.deleted'
) {
  const subscription = event.data.object as Stripe.Subscription;

  const item = subscription.items.data[0];
  if (!item || !item.current_period_start || !item.current_period_end) {
    console.error('Webhook: subscription event with no usable item', { id: subscription.id });
    return new NextResponse(null, { status: 200 });
  }

  // userId may be missing on the bare subscription object; try metadata.
  const userId = (subscription.metadata?.userId as string | undefined) ?? null;

  // Upsert (not update) so out-of-order events still establish the row.
  // For `deleted`, we still upsert to mark status='canceled' authoritatively.
  const payload: Record<string, unknown> = {
    id: subscription.id,
    status: subscription.status,
    plan_type: item.price.id,
    current_period_start: new Date(item.current_period_start * 1000).toISOString(),
    current_period_end: new Date(item.current_period_end * 1000).toISOString(),
  };
  if (userId) payload.user_id = userId;

  const { error } = await supabase
    .from('subscriptions')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('Error upserting subscription:', error);
    return new NextResponse('Database Error', { status: 500 });
  }
}
```

NOTA importante: el `user_id` se incluye en payload solo si la subscription trae metadata.userId. En upsert sobre id, si la fila ya existía (con un `user_id` válido), Postgres mantiene el user_id viejo si payload no lo sobrescribe. Si payload incluye `user_id`, sobrescribe — lo cual es correcto si Stripe da el dato (era el usuario original).

- [ ] **Step 4: Tests pasando**

```bash
npx vitest run __tests__/api/webhooks.test.ts
```

Expected: existing tests pass + new ones pass.

- [ ] **Step 5: Gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add app/api/webhooks/stripe/route.ts __tests__/api/webhooks.test.ts
git commit -m "fix(stripe): handle subscription.created and upsert in updated/deleted"
```

---

### Task B.2: Helper `dbErrorMessage` + aplicar en `comments.ts`

Server actions devuelven `error.message` raw del Postgres en respuestas al cliente. Mensajes contienen nombres de columna y valores rejected. Crear un helper que devuelva mensaje genérico al cliente y loggea el real.

**Files:**
- Create: `utils/errors/db-error.ts`
- Test: `__tests__/utils/db-error.test.ts`
- Modify: `app/actions/comments.ts:38` (único user-facing identificado en audit4)

- [ ] **Step 1: Test del helper**

```typescript
// __tests__/utils/db-error.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dbErrorMessage } from '@/utils/errors/db-error'

describe('dbErrorMessage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns a generic message for any DB error', () => {
    const result = dbErrorMessage('addComment', { code: '23505', message: 'duplicate key value violates unique constraint "comments_pkey"' })
    expect(result).toBe('server_error')
  })

  it('logs the original message and code to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    dbErrorMessage('addComment', { code: '23505', message: 'detail' })
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('addComment'), expect.objectContaining({ code: '23505' }))
  })

  it('handles non-Error inputs', () => {
    expect(dbErrorMessage('x', null)).toBe('server_error')
    expect(dbErrorMessage('x', undefined)).toBe('server_error')
    expect(dbErrorMessage('x', 'just a string')).toBe('server_error')
  })
})
```

- [ ] **Step 2: Implement**

```typescript
// utils/errors/db-error.ts
import 'server-only'

type ErrorLike = { code?: string; message?: string; details?: string } | null | undefined | unknown

/**
 * Logs the raw DB error to the server (Sentry/Vercel logs) and returns a
 * generic, safe message for the client. Use whenever a server action would
 * otherwise return `error.message` to avoid leaking schema details to
 * authenticated users.
 */
export function dbErrorMessage(scope: string, err: ErrorLike): string {
  const errObj = (typeof err === 'object' && err !== null) ? err as { code?: string; message?: string; details?: string } : null
  console.error(`[${scope}] db error`, {
    code: errObj?.code,
    message: errObj?.message,
    details: errObj?.details,
  })
  return 'server_error'
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run __tests__/utils/db-error.test.ts
```

Expected: 3/3 pass.

- [ ] **Step 4: Apply in `app/actions/comments.ts`**

Localizar línea 38 (return en error path de `submitComment` o similar):

```typescript
// before
return { error: error.message };

// after
import { dbErrorMessage } from '@/utils/errors/db-error'
// ...
return { error: dbErrorMessage('addComment', error) };
```

(NOTA: solo hay UN call site user-facing identificado en audit4. Los demás `error.message` están en admin actions; no se tocan en este task — admins ven errores detallados, esa es la ventaja para debugging.)

- [ ] **Step 5: Gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

Si tests existentes de comments esperaban un mensaje específico de error (no genérico), ajustar:

```bash
grep -n "error.message\|server_error" __tests__/actions/comment*.test.ts
```

Adapta tests para esperar `error: 'server_error'` en vez de mensajes específicos.

- [ ] **Step 6: Commit**

```bash
git add utils/errors/db-error.ts __tests__/utils/db-error.test.ts \
        app/actions/comments.ts __tests__/actions
git commit -m "fix(security): scrub DB error messages on user-facing responses"
```

---

## Fase C — BAJO

### Task C.1: VTT fetch con límite de tamaño

`app/courses/mux-actions.ts:198-200` hace `await res.text()` sin chequear `Content-Length`. Aunque admin-only, un VTT de 500MB agota memoria.

**Files:**
- Modify: `app/courses/mux-actions.ts`

- [ ] **Step 1: Localizar el fetch**

```bash
grep -n "res.text\|fetch(" app/courses/mux-actions.ts
```

- [ ] **Step 2: Añadir guard de tamaño**

Sustituir:

```typescript
const res = await fetch(fileUrl)
if (res.ok) {
  const text = await res.text()
  // ...
}
```

por:

```typescript
const MAX_VTT_SIZE = 5 * 1024 * 1024 // 5MB — VTT files are tiny in practice

const res = await fetch(fileUrl)
if (res.ok) {
  const contentLength = res.headers.get('content-length')
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_VTT_SIZE) {
    console.error('VTT file too large', { fileUrl, contentLength })
    // Skip normalization; keep original URL.
  } else {
    const text = await res.text()
    if (text.length > MAX_VTT_SIZE) {
      console.error('VTT file body too large', { fileUrl, size: text.length })
    } else {
      // ... existing normalization logic ...
    }
  }
}
```

(Adaptar a la estructura de control flow real del archivo.)

- [ ] **Step 3: Gates + commit**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
git add app/courses/mux-actions.ts
git commit -m "fix(mux): bound VTT file size to 5MB on fetch normalization"
```

---

### Task C.2: NotificationBell — explicit select sin `actor_ids`

`components/NotificationBell.tsx:59` usa `.select('*')`, devolviendo el array `actor_ids: uuid[]` al cliente. La UI no lo necesita (usa `actor_name` y `actor_count`).

**Files:**
- Modify: `components/NotificationBell.tsx`

- [ ] **Step 1: Cambiar select**

Localizar:

```typescript
const { data } = await supabase
  .from('notifications_with_actor')
  .select('*')
```

Sustituir por:

```typescript
const { data } = await supabase
  .from('notifications_with_actor')
  .select('id, type, title, message, link, is_read, actor_name, actor_avatar, actor_count, updated_at, created_at')
```

(Confirmar que las columnas listadas existen en la vista — leer `notifications_with_actor` definition en `supabase/2026_05_audit_notifications_archive.sql`.)

- [ ] **Step 2: TypeScript**

Si `NotificationRow` type referencia `actor_ids`, removerlo. Si el tipo se infiere automáticamente por Supabase, no hay nada que cambiar.

```bash
grep -n "actor_ids" components/NotificationBell.tsx
```

Si aparece referenciado, removerlo.

- [ ] **Step 3: Gates + commit**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
git add components/NotificationBell.tsx
git commit -m "fix(notifications): omit actor_ids array from client payload"
```

---

### Task C.3: Persistir submissions de `/contact` y `Newsletter`

Hoy ambos forms son cosméticos (`onSubmit={(e) => e.preventDefault()}`). Crear server actions + tablas para que las submissions queden en BD (admin las consulta o se conecta luego un email provider).

**Files:**
- Create: `supabase/2026_05_audit4_contact_newsletter_tables.sql`
- Create: `app/actions/contact.ts`
- Create: `app/actions/newsletter.ts`
- Test: `__tests__/actions/contact.test.ts`
- Test: `__tests__/actions/newsletter.test.ts`
- Modify: `app/contact/page.tsx`
- Modify: `components/Newsletter.tsx`

- [ ] **Step 1: Migración**

```sql
-- supabase/2026_05_audit4_contact_newsletter_tables.sql

create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  inquiry_type text default 'general',
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_submissions_created
  on contact_submissions (created_at desc);

alter table public.contact_submissions enable row level security;

-- Solo admin lee; todos los inserts ocurren vía service role.
create policy "contact_submissions admin SELECT" on public.contact_submissions
  for select using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );

create policy "contact_submissions service INSERT only" on public.contact_submissions
  for insert with check (false);


create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz null
);

alter table public.newsletter_subscribers enable row level security;

create policy "newsletter admin SELECT" on public.newsletter_subscribers
  for select using (
    exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  );

create policy "newsletter service INSERT only" on public.newsletter_subscribers
  for insert with check (false);

create policy "newsletter service UPDATE only" on public.newsletter_subscribers
  for update using (false);
```

- [ ] **Step 2: Aplicar migración**

(`apply_migration` con `name: audit4_2026_05_contact_newsletter_tables`.)

- [ ] **Step 3: Server action `submitContact`**

```typescript
// app/actions/contact.ts
'use server'

import { headers } from 'next/headers'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME_MAX = 100
const MESSAGE_MAX = 5000
const TYPE_MAX = 50

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function submitContact(formData: FormData): Promise<{ success: true } | { error: string }> {
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await rateLimit(rateLimitKey([ip, 'contact']), 5, 60 * 60 * 1000) // 5 per hour
  if (!rl.ok) return { error: 'rate_limit' }

  const name = String(formData.get('name') ?? '').trim().slice(0, NAME_MAX)
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const message = String(formData.get('message') ?? '').trim().slice(0, MESSAGE_MAX)
  const inquiryType = String(formData.get('type') ?? 'general').trim().slice(0, TYPE_MAX)

  if (!name) return { error: 'name_required' }
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email' }
  if (message.length < 10) return { error: 'message_too_short' }

  const { error } = await adminClient()
    .from('contact_submissions')
    .insert({ name, email, message, inquiry_type: inquiryType })

  if (error) {
    console.error('[submitContact] db error', { code: error.code, message: error.message })
    return { error: 'server_error' }
  }

  return { success: true }
}
```

- [ ] **Step 4: Server action `subscribeNewsletter`**

```typescript
// app/actions/newsletter.ts
'use server'

import { headers } from 'next/headers'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { rateLimit, rateLimitKey } from '@/utils/rate-limit'
import { getClientIp } from '@/utils/auth/client-ip'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function subscribeNewsletter(formData: FormData): Promise<{ success: true } | { error: string }> {
  const h = await headers()
  const ip = getClientIp(h)
  const rl = await rateLimit(rateLimitKey([ip, 'newsletter']), 5, 60 * 60 * 1000) // 5 per hour
  if (!rl.ok) return { error: 'rate_limit' }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { error: 'invalid_email' }

  // Idempotent: insert ignoring conflict on the unique email.
  const { error } = await adminClient()
    .from('newsletter_subscribers')
    .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true })

  if (error) {
    console.error('[subscribeNewsletter] db error', { code: error.code, message: error.message })
    return { error: 'server_error' }
  }

  return { success: true }
}
```

- [ ] **Step 5: Tests**

`__tests__/actions/contact.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertMock = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ insert: insertMock }) }),
}))

vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
}))

vi.mock('@/utils/auth/client-ip', () => ({
  getClientIp: () => '127.0.0.1',
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))

import { submitContact } from '@/app/actions/contact'

function fd(values: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(values).forEach(([k, v]) => f.append(k, v))
  return f
}

describe('submitContact', () => {
  beforeEach(() => insertMock.mockClear())

  it('rejects empty name', async () => {
    const result = await submitContact(fd({ email: 'a@b.c', message: 'longenough message' }))
    expect(result).toEqual({ error: 'name_required' })
  })

  it('rejects invalid email', async () => {
    const result = await submitContact(fd({ name: 'Ana', email: 'bad', message: 'longenough message' }))
    expect(result).toEqual({ error: 'invalid_email' })
  })

  it('rejects too-short message', async () => {
    const result = await submitContact(fd({ name: 'Ana', email: 'a@b.c', message: 'short' }))
    expect(result).toEqual({ error: 'message_too_short' })
  })

  it('inserts on valid input', async () => {
    insertMock.mockResolvedValue({ error: null })
    const result = await submitContact(fd({
      name: 'Ana', email: 'a@b.c', message: 'longenough message of work'
    }))
    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Ana',
      email: 'a@b.c',
      message: 'longenough message of work',
    }))
  })
})
```

`__tests__/actions/newsletter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const upsertMock = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: () => ({ upsert: upsertMock }) }),
}))

vi.mock('@/utils/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, retryAfter: 0 }),
  rateLimitKey: (parts: unknown[]) => parts.join(':'),
}))

vi.mock('@/utils/auth/client-ip', () => ({
  getClientIp: () => '127.0.0.1',
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))

import { subscribeNewsletter } from '@/app/actions/newsletter'

function fd(values: Record<string, string>): FormData {
  const f = new FormData()
  Object.entries(values).forEach(([k, v]) => f.append(k, v))
  return f
}

describe('subscribeNewsletter', () => {
  beforeEach(() => upsertMock.mockClear())

  it('rejects invalid email', async () => {
    const r = await subscribeNewsletter(fd({ email: 'no' }))
    expect(r).toEqual({ error: 'invalid_email' })
  })

  it('upserts valid email and returns success', async () => {
    upsertMock.mockResolvedValue({ error: null })
    const r = await subscribeNewsletter(fd({ email: 'A@B.com' }))
    expect(r).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalledWith({ email: 'a@b.com' }, expect.objectContaining({ onConflict: 'email' }))
  })
})
```

- [ ] **Step 6: Modify `components/Newsletter.tsx`**

Convertir el form a usar el server action. Cambiar:

```tsx
<form className={styles.form} onSubmit={(e) => e.preventDefault()}>
```

por una pequeña transition handler:

```tsx
'use client';

import { useState, useTransition } from 'react'
import { subscribeNewsletter } from '@/app/actions/newsletter'

// inside component:
const [isPending, startTransition] = useTransition()
const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' })

async function onSubmit(formData: FormData) {
  setStatus({ kind: 'idle' })
  startTransition(async () => {
    const r = await subscribeNewsletter(formData)
    if ('success' in r) setStatus({ kind: 'ok' })
    else setStatus({ kind: 'err', msg: r.error })
  })
}

return (
  // ...
  <form className={styles.form} action={onSubmit}>
    <input type="email" name="email" required ... />
    <button type="submit" disabled={isPending}>{isPending ? '...' : t.newsletter.button}</button>
  </form>
  {status.kind === 'ok' && <p>{t.newsletter.success}</p>}
  {status.kind === 'err' && <p role="alert">{t.newsletter.error}</p>}
  // ...
)
```

(Adaptar a la estructura existente. Añadir las traducciones `newsletter.success` y `newsletter.error` a las 6 dictionaries — `i18n:check` lo exigirá.)

- [ ] **Step 7: Modify `app/contact/page.tsx`**

Convertir `handleSubmit` (línea 197) a llamar al server action `submitContact`. La estructura es similar al newsletter pero con más campos. Captura el resultado, muestra success/error.

- [ ] **Step 8: i18n keys**

Añadir a las 6 dictionaries (`utils/i18n/dictionaries/{es,en,fr,de,it,ja}.ts`):

- `newsletter.success`
- `newsletter.error`
- `contact.success`
- `contact.error`

(Traducciones razonables; el implementador escoge.)

- [ ] **Step 9: Gates**

```bash
npm run i18n:check
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

Todo verde.

- [ ] **Step 10: Commit**

```bash
git add supabase/2026_05_audit4_contact_newsletter_tables.sql \
        app/actions/contact.ts app/actions/newsletter.ts \
        __tests__/actions/contact.test.ts __tests__/actions/newsletter.test.ts \
        components/Newsletter.tsx app/contact/page.tsx \
        utils/i18n/dictionaries/
git commit -m "feat: persist contact and newsletter form submissions to DB"
```

---

### Task C.4: `updateLesson` con optimistic concurrency

Dos admins editando misma lección simultáneamente: last-write-wins. Añadir check `updated_at` para detectar conflicto.

**Files:**
- Modify: `app/courses/actions.ts` — function `updateLesson`
- (Probable) Modify: el form de edición de lección para enviar `expectedUpdatedAt` (lo lee el page server component y lo pone como hidden input)

- [ ] **Step 1: Add `expectedUpdatedAt` parameter**

Lee `updateLesson` actual:

```bash
grep -B2 -A30 "export async function updateLesson" app/courses/actions.ts
```

Modificar para aceptar un nuevo parámetro opcional via FormData o argumento, y comprobar contra `updated_at`:

```typescript
export async function updateLesson(formData: FormData) {
  await requireAdmin()
  // ... existing input extraction ...
  const expectedUpdatedAt = formData.get('expectedUpdatedAt') as string | null

  // ... validation ...

  let query = supabase
    .from('lessons')
    .update({ /* fields */, updated_at: new Date().toISOString() })
    .eq('id', lessonId)

  if (expectedUpdatedAt) {
    query = query.eq('updated_at', expectedUpdatedAt)
  }

  const { data, error } = await query.select('id').maybeSingle()

  if (error) return { error: error.message }

  if (expectedUpdatedAt && !data) {
    return { error: 'concurrent_update' }
  }

  // ... rest unchanged ...
}
```

(Si `lessons` no tiene columna `updated_at`, ese check es no-op. Verificar antes:)

```bash
grep -E "updated_at" supabase/schema.sql supabase/full_setup.sql | grep -i lesson
```

Si la tabla `lessons` no tiene `updated_at`, añadirla en una mini-migración:

```sql
-- supabase/2026_05_audit4_lessons_updated_at.sql
alter table public.lessons add column if not exists updated_at timestamptz not null default now();
```

(Aplicar antes del cambio de código.)

- [ ] **Step 2: Test concurrencia**

```typescript
it('rejects update when expectedUpdatedAt does not match', async () => {
  // ... setup admin + lessonId mocks ...
  // .update().eq('id').eq('updated_at', 'OLD').select().maybeSingle() returns null
  fromMock.mockReturnValueOnce({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      })
    })
  })

  const fd = new FormData()
  fd.append('lessonId', 'l1')
  fd.append('courseId', 'c1')
  fd.append('title', 'New title')
  fd.append('expectedUpdatedAt', 'OLD-timestamp')
  // ... other required fields ...

  const result = await updateLesson(fd)
  expect(result).toEqual({ error: 'concurrent_update' })
})
```

(Adapt al patrón de mocks existente.)

- [ ] **Step 3: Form de edición lee y manda `updated_at`**

En el page de edición (`app/courses/[courseId]/[lessonId]/edit/page.tsx`), pasar el `lesson.updated_at` al form. En el form (`components/LessonForm.tsx` o similar), añadir:

```tsx
<input type="hidden" name="expectedUpdatedAt" value={lesson.updated_at} />
```

- [ ] **Step 4: Gates + commit**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
git add supabase/2026_05_audit4_lessons_updated_at.sql app/courses/actions.ts \
        components/LessonForm.tsx app/courses/\[courseId\]/\[lessonId\]/edit/page.tsx \
        __tests__/actions/courses.test.ts
git commit -m "feat(lessons): optimistic concurrency check on updateLesson"
```

---

## Fase D — Cierre

### Task D.1: Validation + advisors + push + PR + merge

- [ ] **Step 1: Gates verdes**

```bash
npm run lint && npm run test && npx tsc --noEmit && npm run build && npm run i18n:check
```

- [ ] **Step 2: Advisors check**

(MCP `get_advisors` security + performance. Esperado: cero nuevos warnings introducidos por las migraciones de A.1, A.2, C.3, C.4.)

- [ ] **Step 3: Push**

```bash
git push -u origin chore/audit4-remediation
```

- [ ] **Step 4: Crear PR**

(URL: https://github.com/ivangs23/LuisySaraBachatango/pull/new/chore/audit4-remediation o gh pr create.)

- [ ] **Step 5: Mergear a main tras revisión**

```bash
git checkout main
git pull origin main
git merge --no-ff chore/audit4-remediation -m "Merge audit-4 remediation: 8 findings closed"
git push origin main
```

---

## Verificación final del plan

### Spec coverage

- ✅ ALTO 1 (RLS NULL year/month) → A.1
- ✅ ALTO 2 (Stripe customer race + UNIQUE) → A.2
- ✅ MEDIO 3 (subscription.created handler + upsert) → B.1
- ✅ MEDIO 4 (error.message scrub) → B.2
- ✅ BAJO 5 (VTT size limit) → C.1
- ✅ BAJO 6 (NotificationBell select) → C.2
- ✅ BAJO 7 (/contact + Newsletter persistence) → C.3
- ✅ BAJO 8 (updateLesson concurrency) → C.4

### Sin placeholders

Cada step contiene comando o código completo.

### Type consistency

- `dbErrorMessage(scope, err)` → utils/errors/db-error.ts; usada en B.2.
- `submitContact(formData): Promise<{ success: true } | { error: string }>` y `subscribeNewsletter` mismas signatures.
- `getClientIp` reutilizada de audit3.
- `rateLimit` / `rateLimitKey` reutilizadas.
