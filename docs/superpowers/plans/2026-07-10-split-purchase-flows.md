# Separar flujos de compra (web vs landing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar el flujo de compra de la web normal (login-first) del de la landing (formulario propio → cuenta), y marcar el origen (`source`) de cada compra.

**Architecture:** La landing usa su propia acción `landingCheckout` (formulario nombre+email → demo simula / real Stripe). `/api/checkout` queda solo para la web logueada. `provisionGuestPurchase` gana `source`/`fullName`. Se retira `/demo-checkout`+`simulatePurchase` (los sustituye el form de la landing). El origen va en `course_purchases.source`.

**Tech Stack:** Next.js 16 (route handlers, server components, server actions), Supabase admin, Stripe, Vitest.

## Global Constraints

- La clave `source`/`is_demo` se incluye en el upsert de `course_purchases` **solo** cuando el valor está presente (patrón condicional) → la rama que no lo usa no depende de la migración.
- Web normal ya está gateada por login (`CoursePreviewShell` para anónimos); `BuyCourseButton` solo lo pulsa un logueado. NO añadir redirect a signup en el botón.
- `provisionGuestPurchase(session, admin, opts?: { isDemo?: boolean; source?: string; fullName?: string })` — firma nueva.
- Landing guest metadata Stripe: `{ courseId, guest:'1', source:'landing', fullName }`. Web logueado: `{ userId, courseId, source:'web' }`.
- Email/nombre: email siempre en minúsculas; `fullName` va en `data` del invite → trigger `handle_new_user` puebla `profiles.full_name`.
- Tests: unit `__tests__/unit`, api `__tests__/api`, actions `__tests__/actions`, components `__tests__/components` (jsdom). Antes de cada commit: `npx tsc --noEmit` (0 err) + `npx eslint <archivos>` (0 err); suite completa verde antes del commit final de cada tarea.

---

## File Structure
- `supabase/2026_07_source.sql` — migración columna `source` (crear).
- `utils/checkout/provision-guest.ts` — opts source+fullName (modificar).
- `app/curso-bachatango/comprar/page.tsx` — página form landing (crear).
- `app/curso-bachatango/comprar/actions.ts` — `landingCheckout` (crear).
- `components/LandingCheckoutForm.tsx` — form cliente (crear).
- `app/curso-bachatango/_components/CourseCtaButton.tsx` — pasa a link (modificar).
- `app/api/checkout/route.ts` — web-only (modificar).
- `app/api/webhooks/stripe/route.ts` — source+fullName (modificar).
- Eliminar: `app/demo-checkout/` (page+actions), `__tests__/api/demo-checkout.test.ts`, `__tests__/actions/simulate-purchase.test.ts`.
- Tests nuevos/extendidos por tarea.

---

### Task 1: Migración `source` + `provisionGuestPurchase` source/fullName

**Files:**
- Create: `supabase/2026_07_source.sql`
- Modify: `utils/checkout/provision-guest.ts`
- Test: `__tests__/unit/provision-guest.test.ts`

**Interfaces:**
- Produces: `provisionGuestPurchase(session, admin, opts?: { isDemo?: boolean; source?: string; fullName?: string })`.

- [ ] **Step 1: Tests (fallan primero)**

Añadir a `__tests__/unit/provision-guest.test.ts` (usa el mock `makeAdmin` con `admin._spies` existente):

```ts
  it('con source y fullName: upsert incluye source y el invite pasa data.full_name', async () => {
    const admin = makeAdmin({ existingId: null, inviteUser: { id: 'new-user' } })
    await provisionGuestPurchase(makeSession(), admin, { source: 'landing', fullName: 'María López' })
    const inviteArg = admin._spies.inviteUserByEmail.mock.calls[0][1]
    expect(inviteArg.data).toEqual(expect.objectContaining({ full_name: 'María López' }))
    const [payload] = admin._spies.upsert.mock.calls[0]
    expect(payload.source).toBe('landing')
  })

  it('sin source: el upsert NO incluye la clave source', async () => {
    const admin = makeAdmin({ existingId: null, inviteUser: { id: 'new-user' } })
    await provisionGuestPurchase(makeSession(), admin)
    const [payload] = admin._spies.upsert.mock.calls[0]
    expect('source' in payload).toBe(false)
  })
```

- [ ] **Step 2: Ejecutar — fallan**

Run: `npx vitest run __tests__/unit/provision-guest.test.ts`
Expected: FAIL (opts no acepta source/fullName; upsert/invite no los usan).

- [ ] **Step 3: Modificar `provisionGuestPurchase`**

Firma:
```ts
export async function provisionGuestPurchase(
  session: Stripe.Checkout.Session,
  admin: SupabaseClient,
  opts: { isDemo?: boolean; source?: string; fullName?: string } = {},
): Promise<ProvisionResult> {
```

Bloque invite (paso 2) — construir `data` con full_name y/o is_demo:
```ts
  if (!userId) {
    const redirectTo = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/auth/callback?next=/reset-password`;
    const meta: Record<string, unknown> = {};
    if (opts.fullName) meta.full_name = opts.fullName;
    if (opts.isDemo) meta.is_demo = true;
    const inviteOptions: { redirectTo: string; data?: Record<string, unknown> } = { redirectTo };
    if (Object.keys(meta).length > 0) inviteOptions.data = meta;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
    if (invited?.user?.id) {
      userId = invited.user.id;
    } else {
      const { data: reFetched } = await admin
        .from('profiles').select('id').eq('email', email).maybeSingle();
      userId = reFetched?.id;
      if (!userId) return { ok: false, reason: `invite-failed:${inviteError?.message ?? 'unknown'}` };
    }
  }
```

Bloque upsert (paso 3) — añadir `source` condicional (además del `is_demo` ya presente):
```ts
  const purchase: Record<string, unknown> = {
    user_id: userId,
    course_id: courseId,
    stripe_session_id: session.id,
    amount_paid: session.amount_total ?? null,
  };
  if (opts.isDemo) purchase.is_demo = true;
  if (opts.source) purchase.source = opts.source;

  const { error: purchaseError } = await admin
    .from('course_purchases')
    .upsert(purchase, { onConflict: 'stripe_session_id', ignoreDuplicates: true });
  if (purchaseError) {
    if (purchaseError.code === '23505') return { ok: true, userId };
    return { ok: false, reason: `purchase-error:${purchaseError.message}` };
  }
```

(Resto de la función sin cambios.)

- [ ] **Step 4: Crear migración**

Crear `supabase/2026_07_source.sql`:
```sql
-- Origen de cada compra: 'web' | 'landing'.
alter table course_purchases add column if not exists source text;
```

- [ ] **Step 5: Ejecutar — pasan**

Run: `npx vitest run __tests__/unit/provision-guest.test.ts`
Expected: PASS (previos + 2 nuevos).

- [ ] **Step 6: Typecheck/lint + commit**

Run: `npx tsc --noEmit` (0 err), `npx eslint utils/checkout/provision-guest.ts __tests__/unit/provision-guest.test.ts` (0 err).
```bash
git add utils/checkout/provision-guest.ts __tests__/unit/provision-guest.test.ts supabase/2026_07_source.sql
git commit -m "feat(checkout): provisionGuestPurchase acepta source y fullName + migración source"
```

---

### Task 2: Landing — página `/curso-bachatango/comprar` + `landingCheckout` + CTA a link

**Files:**
- Create: `app/curso-bachatango/comprar/page.tsx`, `app/curso-bachatango/comprar/actions.ts`, `components/LandingCheckoutForm.tsx`
- Modify: `app/curso-bachatango/_components/CourseCtaButton.tsx`
- Test: `__tests__/actions/landing-checkout.test.ts`, `__tests__/api/comprar-page.test.ts`

**Interfaces:**
- Consumes: `isDemoMode`, `provisionGuestPurchase` (Task 1).
- Produces: `landingCheckout(formData: FormData): Promise<void>`.

- [ ] **Step 1: Test de `landingCheckout` (falla primero)**

Crear `__tests__/actions/landing-checkout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockIsDemoMode, mockProvision, mockSessionCreate, mockCourseSingle, mockRedirect } = vi.hoisted(() => ({
  mockIsDemoMode: vi.fn(),
  mockProvision: vi.fn().mockResolvedValue({ ok: true, userId: 'u1' }),
  mockSessionCreate: vi.fn().mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }),
  mockCourseSingle: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 199 }, error: null }),
  mockRedirect: vi.fn((u: string) => { throw new Error('REDIRECT:' + u) }),
}))
vi.mock('@/utils/demo/mode', () => ({ isDemoMode: () => mockIsDemoMode() }))
vi.mock('@/utils/checkout/provision-guest', () => ({ provisionGuestPurchase: (...a: unknown[]) => mockProvision(...a) }))
vi.mock('@/utils/stripe/server', () => ({ stripe: { checkout: { sessions: { create: mockSessionCreate } } } }))
vi.mock('next/navigation', () => ({ redirect: (u: string) => mockRedirect(u) }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockCourseSingle }),
  }),
}))

import { landingCheckout } from '@/app/curso-bachatango/comprar/actions'

function fd(o: Record<string, string>) { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.append(k, v)); return f }
beforeEach(() => vi.clearAllMocks())

describe('landingCheckout', () => {
  it('demo: provisiona sintético con source landing + fullName y va a /gracias?demo=1', async () => {
    mockIsDemoMode.mockReturnValue(true)
    await expect(landingCheckout(fd({ courseId: 'c1', email: 'Buyer@Example.com', fullName: 'Ana' })))
      .rejects.toThrow('REDIRECT:/gracias?demo=1&email=buyer%40example.com')
    const [session, , opts] = mockProvision.mock.calls[0]
    expect(session.customer_details.email).toBe('buyer@example.com')
    expect(session.metadata).toEqual(expect.objectContaining({ courseId: 'c1', source: 'landing', fullName: 'Ana' }))
    expect(opts).toEqual({ isDemo: true, source: 'landing', fullName: 'Ana' })
    expect(mockSessionCreate).not.toHaveBeenCalled()
  })

  it('real: crea sesión Stripe con customer_email + metadata y redirige a Stripe', async () => {
    mockIsDemoMode.mockReturnValue(false)
    await expect(landingCheckout(fd({ courseId: 'c1', email: 'buyer@example.com', fullName: 'Ana' })))
      .rejects.toThrow('REDIRECT:https://checkout.stripe.com/x')
    const arg = mockSessionCreate.mock.calls[0][0]
    expect(arg.customer_email).toBe('buyer@example.com')
    expect(arg.metadata).toEqual(expect.objectContaining({ courseId: 'c1', guest: '1', source: 'landing', fullName: 'Ana' }))
    expect(mockProvision).not.toHaveBeenCalled()
  })

  it('sin email o nombre: redirige de vuelta con error, sin provisionar ni Stripe', async () => {
    mockIsDemoMode.mockReturnValue(false)
    await expect(landingCheckout(fd({ courseId: 'c1', email: '', fullName: '' })))
      .rejects.toThrow(/REDIRECT:\/curso-bachatango\/comprar/)
    expect(mockProvision).not.toHaveBeenCalled()
    expect(mockSessionCreate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Ejecutar — falla**

Run: `npx vitest run __tests__/actions/landing-checkout.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `landingCheckout`**

Crear `app/curso-bachatango/comprar/actions.ts`:

```ts
'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import type Stripe from 'stripe';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { stripe } from '@/utils/stripe/server';
import { STRIPE_CONFIG } from '@/utils/stripe/config';
import { isDemoMode } from '@/utils/demo/mode';
import { provisionGuestPurchase } from '@/utils/checkout/provision-guest';

export async function landingCheckout(formData: FormData): Promise<void> {
  const courseId = ((formData.get('courseId') as string | null) ?? '').trim();
  const fullName = ((formData.get('fullName') as string | null) ?? '').trim();
  const email = ((formData.get('email') as string | null) ?? '').trim().toLowerCase();

  if (!courseId || !email || !fullName) {
    redirect(`/curso-bachatango/comprar?courseId=${encodeURIComponent(courseId)}&error=missing`);
  }

  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: course } = await admin
    .from('courses').select('title, price_eur').eq('id', courseId).eq('is_published', true).single();
  if (!course || !course.price_eur || course.price_eur <= 0 || course.price_eur > 10000) {
    redirect(`/curso-bachatango/comprar?courseId=${encodeURIComponent(courseId)}&error=course`);
  }

  const amount = Math.round(course.price_eur * 100);
  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  if (isDemoMode()) {
    const session = {
      id: `demo_${randomUUID()}`,
      customer_details: { email },
      metadata: { courseId, source: 'landing', fullName },
      amount_total: amount,
      customer: null,
    } as unknown as Stripe.Checkout.Session;
    await provisionGuestPurchase(session, admin, { isDemo: true, source: 'landing', fullName });
    redirect(`/gracias?demo=1&email=${encodeURIComponent(email)}`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    billing_address_collection: 'auto',
    customer_creation: 'always',
    customer_email: email,
    line_items: [{
      price_data: {
        currency: STRIPE_CONFIG.CURRENCY,
        unit_amount: amount,
        product_data: { name: course.title },
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${origin}/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/curso-bachatango`,
    metadata: { courseId, guest: '1', source: 'landing', fullName },
  });

  redirect(session.url!);
}
```

- [ ] **Step 4: Ejecutar — pasa**

Run: `npx vitest run __tests__/actions/landing-checkout.test.ts`
Expected: PASS (3 casos).

- [ ] **Step 5: Test de la página (falla primero)**

Crear `__tests__/api/comprar-page.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNotFound = vi.fn(() => { throw new Error('NOT_FOUND') })
vi.mock('next/navigation', () => ({ notFound: () => mockNotFound() }))
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } })
const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'c1', title: 'Curso', price_eur: 199 }, error: null })
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockSingle }),
  }),
}))

import ComprarPage from '@/app/curso-bachatango/comprar/page'
beforeEach(() => vi.clearAllMocks())

describe('/curso-bachatango/comprar', () => {
  it('notFound sin courseId', async () => {
    await expect(ComprarPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND')
  })
  it('renderiza el título del curso y el form', async () => {
    const el = await ComprarPage({ searchParams: Promise.resolve({ courseId: 'c1' }) })
    expect(JSON.stringify(el)).toContain('Curso')
  })
})
```

- [ ] **Step 6: Implementar página + form**

Crear `components/LandingCheckoutForm.tsx`:

```tsx
'use client';

import { landingCheckout } from '@/app/curso-bachatango/comprar/actions';
import styles from '@/app/curso-bachatango/comprar/comprar.module.css';

interface Props { courseId: string; defaultEmail: string; defaultName: string; error?: string }

export default function LandingCheckoutForm({ courseId, defaultEmail, defaultName, error }: Props) {
  return (
    <form action={landingCheckout} className={styles.form}>
      <input type="hidden" name="courseId" value={courseId} />
      {error && <p className={styles.error}>Revisa tus datos e inténtalo de nuevo.</p>}
      <label className={styles.label} htmlFor="lc-name">Nombre</label>
      <input id="lc-name" name="fullName" type="text" required defaultValue={defaultName} className={styles.input} />
      <label className={styles.label} htmlFor="lc-email">Email</label>
      <input id="lc-email" name="email" type="email" required defaultValue={defaultEmail} placeholder="tu@email.com" className={styles.input} />
      <button type="submit" className={styles.button}>Continuar al pago</button>
      <p className={styles.note}>Te crearemos el acceso con estos datos y te enviaremos un email.</p>
    </form>
  );
}
```

Crear `app/curso-bachatango/comprar/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import LandingCheckoutForm from '@/components/LandingCheckoutForm';
import styles from './comprar.module.css';

export const metadata: Metadata = { title: 'Comprar CURSO BACHATANGO', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ComprarPage(props: { searchParams: Promise<{ courseId?: string; error?: string }> }) {
  const { courseId, error } = await props.searchParams;
  if (!courseId) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: course } = await supabase
    .from('courses').select('id, title, price_eur').eq('id', courseId).eq('is_published', true).single();
  if (!course) notFound();

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{course.title}</h1>
        <p className={styles.price}>€{course.price_eur} · pago único</p>
        <LandingCheckoutForm courseId={course.id} defaultEmail={user?.email ?? ''} defaultName="" error={error} />
      </div>
    </div>
  );
}
```

Crear `app/curso-bachatango/comprar/comprar.module.css`:

```css
.wrap { min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: var(--spacing-2xl) var(--page-pad); background: #050505; }
.card { max-width: 460px; width: 100%; background: var(--surface); border: 1px solid var(--primary); border-radius: var(--radius-lg); padding: var(--spacing-2xl); text-align: center; }
.title { font: var(--h3); color: var(--text-main); margin-bottom: var(--spacing-sm); }
.price { color: var(--primary); font: var(--h4); margin-bottom: var(--spacing-lg); }
.form { display: flex; flex-direction: column; gap: var(--spacing-sm); text-align: left; }
.label { font: var(--small); color: var(--text-muted); }
.input { padding: 0.7rem 1rem; background: var(--background); border: 1px solid var(--border); border-radius: var(--radius-md); color: var(--text-main); font: var(--body); }
.button { margin-top: var(--spacing-sm); padding: 0.9rem 2rem; background: var(--primary); color: #050505; border: none; border-radius: var(--radius-pill); font: var(--h4); cursor: pointer; }
.button:hover { background: var(--primary-hover); }
.note { font: var(--small); color: var(--text-muted); margin-top: var(--spacing-sm); }
.error { color: #ff8a8a; font: var(--small); }
```

- [ ] **Step 7: CTA de la landing → link**

Reemplazar `app/curso-bachatango/_components/CourseCtaButton.tsx` por:

```tsx
import styles from '../page.module.css';

interface CourseCtaButtonProps {
  courseId: string;
  label: string;
  className?: string;
}

export default function CourseCtaButton({ courseId, label, className }: CourseCtaButtonProps) {
  return (
    <a href={`/curso-bachatango/comprar?courseId=${courseId}`} className={`${styles.cta} ${className ?? ''}`}>
      {label}
    </a>
  );
}
```

(Deja de ser `'use client'` y de hacer fetch. Sus consumidores Hero/Sticky/Sections no cambian props.)

- [ ] **Step 8: Ejecutar tests + typecheck/lint + commit**

Run: `npx vitest run __tests__/actions/landing-checkout.test.ts __tests__/api/comprar-page.test.ts` (PASS), `npx tsc --noEmit` (0 err), `npx eslint app/curso-bachatango/comprar/ components/LandingCheckoutForm.tsx app/curso-bachatango/_components/CourseCtaButton.tsx` (0 err).
```bash
git add app/curso-bachatango/comprar/ components/LandingCheckoutForm.tsx app/curso-bachatango/_components/CourseCtaButton.tsx __tests__/actions/landing-checkout.test.ts __tests__/api/comprar-page.test.ts
git commit -m "feat(landing): página /comprar con form propio + landingCheckout (demo/Stripe)"
```

---

### Task 3: `/api/checkout` solo web (401 anónimo, source:web, demo simula)

**Files:**
- Modify: `app/api/checkout/route.ts`
- Test: `__tests__/api/checkout.test.ts` (reescribir bloques guest/demo)

**Interfaces:**
- Consumes: `isDemoMode`.

- [ ] **Step 1: Reescribir los tests afectados (rojo)**

En `__tests__/api/checkout.test.ts`: eliminar el `describe('POST /api/checkout — guest ...')` y el `describe('POST /api/checkout — modo demo ...')` anteriores, y añadir:

```ts
describe('POST /api/checkout — web only', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsDemoMode.mockReturnValue(false)
  })

  it('anónimo (sin sesión) con courseId → 401 (no guest checkout)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(401)
    expect(mockSessionCreate).not.toHaveBeenCalled()
  })

  it('logueado real: crea sesión Stripe con metadata source:web', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'u@test.com' } } })
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 199, is_published: true }, error: null }),
    })
    mockSessionCreate.mockResolvedValue({ id: 'cs_web', url: 'https://checkout.stripe.com/web' })
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(200)
    expect(mockSessionCreate.mock.calls[0][0].metadata).toEqual(expect.objectContaining({ userId: 'user-1', courseId: 'course-1', source: 'web' }))
  })
})
```

(Nota: el mock `@supabase/supabase-js` del archivo debe exponer `.upsert` para la rama demo; si no lo tiene, añade `upsert: vi.fn().mockResolvedValue({ error: null })` a su cadena `from`.)

- [ ] **Step 2: Ejecutar — falla**

Run: `npx vitest run __tests__/api/checkout.test.ts`
Expected: FAIL (hoy anónimo+courseId hace guest checkout, no 401).

- [ ] **Step 3: Reescribir el cuerpo del `try` en `/api/checkout`**

Sustituir desde `const { data: { user } } = await supabase.auth.getUser();` hasta el `return NextResponse.json({ sessionId: session.id, url: session.url });` FINAL del guest (todo el interior del try salvo el `catch`) por:

```ts
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { courseId } = await req.json() as { courseId?: string };

    // /api/checkout es SOLO para la web logueada. La landing usa su propio
    // formulario (/curso-bachatango/comprar → landingCheckout).
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!courseId) {
      return NextResponse.json({ error: 'Falta courseId' }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? '';

    const { data: course } = await supabase
      .from('courses')
      .select('title, price_eur, is_published')
      .eq('id', courseId)
      .eq('is_published', true)
      .single();
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    if (!course.price_eur || course.price_eur <= 0) return NextResponse.json({ error: 'Este curso no tiene precio configurado' }, { status: 400 });
    if (course.price_eur > 10000) return NextResponse.json({ error: 'Precio del curso inválido' }, { status: 400 });

    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Modo demo: simula la compra del usuario logueado (sin Stripe).
    if (isDemoMode()) {
      await supabaseAdmin.from('course_purchases').upsert(
        { user_id: user.id, course_id: courseId, stripe_session_id: `demo_${randomUUID()}`, amount_paid: Math.round(course.price_eur * 100), is_demo: true, source: 'web' },
        { onConflict: 'stripe_session_id', ignoreDuplicates: true },
      );
      return NextResponse.json({ url: `/courses/${courseId}` });
    }

    // Comprador logueado real: reutiliza/crea customer.
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    let customerId: string | undefined = profile?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      const { data: updated } = await supabaseAdmin
        .from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id).is('stripe_customer_id', null).select('stripe_customer_id').maybeSingle();
      if (updated?.stripe_customer_id) {
        customerId = updated.stripe_customer_id;
      } else {
        const { data: existing } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
        customerId = existing?.stripe_customer_id ?? customer.id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      line_items: [{ price_data: { currency: STRIPE_CONFIG.CURRENCY, unit_amount: Math.round(course.price_eur * 100), product_data: { name: course.title } }, quantity: 1 }],
      mode: 'payment',
      success_url: `${origin}/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/courses/${courseId}`,
      metadata: { userId: user.id, courseId, source: 'web' },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
```

Añadir el import de `randomUUID` en el head: `import { randomUUID } from 'node:crypto';`.

- [ ] **Step 4: Ejecutar — pasa**

Run: `npx vitest run __tests__/api/checkout.test.ts`
Expected: PASS (401 anónimo + web real source:web + validaciones previas de curso).

- [ ] **Step 5: Typecheck/lint + commit**

Run: `npx tsc --noEmit` (0 err), `npx eslint app/api/checkout/route.ts __tests__/api/checkout.test.ts` (0 err).
```bash
git add app/api/checkout/route.ts __tests__/api/checkout.test.ts
git commit -m "feat(checkout): /api/checkout solo web (401 anónimo, source:web, demo simula)"
```

---

### Task 4: Webhook — source + fullName

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`
- Test: `__tests__/api/webhooks.test.ts` (extender)

**Interfaces:**
- Consumes: `provisionGuestPurchase(session, admin, opts)` (Task 1).

- [ ] **Step 1: Test (falla primero)**

En `__tests__/api/webhooks.test.ts`, añadir un caso que verifica que la rama guest pasa source/fullName, y la logueada añade source al upsert:

```ts
it('guest: pasa source y fullName desde metadata a provisionGuestPurchase', async () => {
  mockProvision.mockResolvedValue({ ok: true, userId: 'guest-user' })
  mockConstructEvent.mockReturnValueOnce({
    type: 'checkout.session.completed',
    data: { object: makeSession({ metadata: { courseId: 'c1', guest: '1', source: 'landing', fullName: 'Ana' }, payment_status: 'paid' }) },
  })
  const { POST } = await import('@/app/api/webhooks/stripe/route')
  const res = await POST(makeWebhookRequest())
  expect(res.status).toBe(200)
  expect(mockProvision).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ source: 'landing', fullName: 'Ana' }))
})

it('logueado: el upsert de course_purchases incluye source:web', async () => {
  mockConstructEvent.mockReturnValueOnce({
    type: 'checkout.session.completed',
    data: { object: makeSession({ metadata: { userId: 'u1', courseId: 'c1', source: 'web' }, payment_status: 'paid' }) },
  })
  const { POST } = await import('@/app/api/webhooks/stripe/route')
  await POST(makeWebhookRequest())
  const payload = mockUpsert.mock.calls[0][0]
  expect(payload.source).toBe('web')
})
```

(Si `makeSession` no admite `metadata` en overrides, extiéndelo. `mockUpsert` es el spy del upsert de `course_purchases` ya existente en el archivo.)

- [ ] **Step 2: Ejecutar — falla**

Run: `npx vitest run __tests__/api/webhooks.test.ts`
Expected: FAIL (hoy no se pasan source/fullName ni se añade source al upsert).

- [ ] **Step 3: Modificar el webhook**

En la rama guest (dentro de `if (!userId)`), cambiar la llamada:
```ts
        const result = await provisionGuestPurchase(session, supabase, {
          source: session.metadata?.source,
          fullName: session.metadata?.fullName,
        });
```

En la rama logueada (upsert de `course_purchases`), añadir `source`:
```ts
        const { error } = await supabase
          .from('course_purchases')
          .upsert(
            {
              user_id: userId,
              course_id: courseId,
              stripe_session_id: session.id,
              amount_paid: session.amount_total ?? null,
              source: session.metadata?.source ?? 'web',
            },
            { onConflict: 'stripe_session_id', ignoreDuplicates: true }
          );
```

- [ ] **Step 4: Ejecutar — pasa**

Run: `npx vitest run __tests__/api/webhooks.test.ts`
Expected: PASS (previos + 2 nuevos).

- [ ] **Step 5: Typecheck/lint + commit**

Run: `npx tsc --noEmit` (0 err), `npx eslint app/api/webhooks/stripe/route.ts __tests__/api/webhooks.test.ts` (0 err).
```bash
git add app/api/webhooks/stripe/route.ts __tests__/api/webhooks.test.ts
git commit -m "feat(checkout): webhook registra source + fullName (guest y web)"
```

---

### Task 5: Retirar `/demo-checkout` + `simulatePurchase` (consolidado en la landing)

**Files:**
- Delete: `app/demo-checkout/page.tsx`, `app/demo-checkout/actions.ts`, `app/demo-checkout/demo-checkout.module.css`, `__tests__/api/demo-checkout.test.ts`, `__tests__/actions/simulate-purchase.test.ts`

- [ ] **Step 1: Confirmar que nada referencia lo que se borra**

Run: `grep -rn "demo-checkout\|simulatePurchase\|DemoCheckoutForm" app/ components/ __tests__/ | grep -v node_modules`
Expected: solo referencias dentro de `app/demo-checkout/` y sus tests (que se borran). Si aparece otra, resolverla antes de borrar. (`/api/checkout` ya no devuelve `/demo-checkout` tras Task 3; la landing usa `/comprar` tras Task 2.)

- [ ] **Step 2: Borrar**

```bash
git rm -r app/demo-checkout __tests__/api/demo-checkout.test.ts __tests__/actions/simulate-purchase.test.ts
```
Nota: `components/DemoCheckoutForm.tsx` — si existe y solo lo usaba la página borrada, bórralo también (`git rm components/DemoCheckoutForm.tsx`). Confirma con el grep del Step 1.

- [ ] **Step 3: Suite completa + tsc + lint + build**

Run: `npx tsc --noEmit` (0 err), `npm run lint` (0 err rama), `npx vitest run` (toda la suite verde), `npm run build` (compila — confirma que no quedan imports colgando).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(demo): retirar /demo-checkout y simulatePurchase (consolidado en /comprar)"
```

---

## Self-Review (autor del plan)

**Spec coverage:** migración source → Task 1; provisionGuestPurchase source/fullName → Task 1; landing form + landingCheckout + CTA link → Task 2; /api/checkout web-only + source:web + demo simula web → Task 3; webhook source/fullName → Task 4; retirar demo-checkout/simulatePurchase → Task 5; web ya login-gated (sin cambios BuyCourseButton) → nota en Global Constraints.

**Placeholder scan:** sin TBD/TODO; código completo.

**Type consistency:** `provisionGuestPurchase(session, admin, opts?: {isDemo?;source?;fullName?})` consistente (Task 1 def, Task 2/4 uso). `landingCheckout(formData): Promise<void>`. Metadata Stripe landing `{courseId,guest:'1',source:'landing',fullName}` y web `{userId,courseId,source:'web'}` consistentes entre acción/route y webhook. `CourseCtaButton {courseId,label,className?}` sin cambio de props (Hero/Sticky/Sections intactos).

**Orden:** Task 2 da a la landing su nueva ruta antes de que Task 3 quite la rama guest de `/api/checkout` → cada commit queda coherente.

**Prerrequisito operativo:** aplicar `supabase/2026_07_source.sql` en la BD para poblar `source` (la rama que no lo usa no se rompe sin ella).
