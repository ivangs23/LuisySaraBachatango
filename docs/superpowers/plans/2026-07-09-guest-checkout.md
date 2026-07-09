# Guest Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un visitante sin cuenta compre el curso pagando directamente; la cuenta se crea/vincula tras el pago en el webhook y el comprador recibe un email para fijar contraseña.

**Architecture:** Enfoque A (provisión en el webhook). `/api/checkout` gana una rama anónima que crea una Checkout Session sin customer (`metadata.guest='1'`, sin `userId`, éxito → `/gracias`). El webhook, al recibir `checkout.session.completed` sin `userId`, llama a un helper testeable `provisionGuestPurchase` que hace find-or-create del user por email (`inviteUserByEmail`) y registra la compra idempotentemente. `CourseCtaButton` pasa a llamar siempre a `/api/checkout`.

**Tech Stack:** Next.js 16 App Router (route handlers + server components), Supabase admin (`@supabase/supabase-js` service role, `auth.admin.inviteUserByEmail`), Stripe (`@/utils/stripe/server`), Vitest.

## Global Constraints

- No romper la rama logueada existente de `/api/checkout` ni del webhook.
- `course_purchases`: INSERT solo service-role (webhook). `user_id NOT NULL`. Upsert idempotente sobre `stripe_session_id` (patrón existente `onConflict: 'stripe_session_id', ignoreDuplicates: true`).
- Curso fijo `COURSE_ID = 'f89a576f-4a77-40f7-93e9-23e6c820ee92'`; precio validado desde la fila del curso (0 < price_eur ≤ 10000), como en la rama logueada.
- Metadata guest: `{ courseId, guest: '1' }` (sin `userId`). Éxito guest → `${origin}/gracias?session_id={CHECKOUT_SESSION_ID}`.
- Email siempre en minúsculas para lookup/creación.
- `NEXT_PUBLIC_BASE_URL` para `redirectTo` del invite y `origin` (patrón existente en checkout).
- Tests: unit en `__tests__/` (node); componentes en `__tests__/components/` (jsdom, primera línea `// @vitest-environment jsdom`). `npx tsc --noEmit` y `npm run lint` deben pasar (0 errores) antes de cada commit.
- Debe pasar la suite completa (`npx vitest run`) antes de cada commit final de tarea.

---

## File Structure

- `utils/checkout/provision-guest.ts` — helper `provisionGuestPurchase(session, admin)` (crear).
- `app/api/checkout/route.ts` — rama anónima (modificar).
- `app/api/webhooks/stripe/route.ts` — rama guest en `checkout.session.completed` (modificar).
- `app/gracias/page.tsx` + `app/gracias/gracias.module.css` — página de confirmación (crear).
- `app/curso-bachatango/_components/CourseCtaButton.tsx` — siempre checkout (modificar).
- `app/curso-bachatango/_components/LandingHero.tsx` — link "inicia sesión" (modificar).
- `app/curso-bachatango/_components/StickyBuyBar.tsx`, `LandingSections.tsx`, `app/curso-bachatango/page.tsx` — quitar `isAuthed` del CTA (modificar).
- Tests: `__tests__/unit/provision-guest.test.ts` (crear), `__tests__/api/checkout.test.ts` (extender), `__tests__/api/webhooks.test.ts` (extender), `__tests__/api/gracias.test.ts` (crear), `__tests__/components/course-cta-button.test.tsx` (actualizar).

---

### Task 1: Helper `provisionGuestPurchase`

**Files:**
- Create: `utils/checkout/provision-guest.ts`
- Test: `__tests__/unit/provision-guest.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ProvisionResult = { ok: true; userId: string } | { ok: false; reason: string };
  export async function provisionGuestPurchase(
    session: import('stripe').Stripe.Checkout.Session,
    admin: import('@supabase/supabase-js').SupabaseClient,
  ): Promise<ProvisionResult>
  ```
  Consumido por el webhook (Task 3).

- [ ] **Step 1: Test (falla primero)**

Crear `__tests__/unit/provision-guest.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import { provisionGuestPurchase } from '@/utils/checkout/provision-guest'

// Chainable mock de un query de supabase-js
function makeAdmin(opts: {
  existingId?: string | null
  reFetchId?: string | null
  inviteUser?: { id: string } | null
  inviteError?: { message: string } | null
  purchaseError?: { message: string } | null
}) {
  const maybeSingle = vi.fn()
  // primera búsqueda por email
  maybeSingle.mockResolvedValueOnce({ data: opts.existingId ? { id: opts.existingId } : null, error: null })
  // re-lookup tras invite (si se usa)
  maybeSingle.mockResolvedValueOnce({ data: opts.reFetchId ? { id: opts.reFetchId } : null, error: null })

  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const upsert = vi.fn().mockResolvedValue({ error: opts.purchaseError ?? null })
  const is = vi.fn().mockResolvedValue({ error: null })
  const updateEq = vi.fn().mockReturnValue({ is })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const from = vi.fn().mockReturnValue({ select, upsert, update })

  const inviteUserByEmail = vi.fn().mockResolvedValue({
    data: { user: opts.inviteUser ?? null },
    error: opts.inviteError ?? null,
  })

  return {
    from,
    auth: { admin: { inviteUserByEmail } },
    _spies: { from, upsert, inviteUserByEmail },
  } as any
}

function makeSession(over: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_guest_1',
    amount_total: 19900,
    customer: 'cus_guest',
    customer_details: { email: 'Buyer@Example.com' },
    metadata: { courseId: 'course-1', guest: '1' },
    ...over,
  } as unknown as Stripe.Checkout.Session
}

beforeEach(() => vi.clearAllMocks())

describe('provisionGuestPurchase', () => {
  it('email nuevo: invita y registra compra con el id devuelto', async () => {
    const admin = makeAdmin({ existingId: null, inviteUser: { id: 'new-user' } })
    const res = await provisionGuestPurchase(makeSession(), admin)
    expect(res).toEqual({ ok: true, userId: 'new-user' })
    expect(admin._spies.inviteUserByEmail).toHaveBeenCalledWith('buyer@example.com', expect.objectContaining({ redirectTo: expect.stringContaining('/auth/callback?next=/reset-password') }))
    expect(admin._spies.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'new-user', course_id: 'course-1', stripe_session_id: 'cs_guest_1', amount_paid: 19900 }),
      expect.objectContaining({ onConflict: 'stripe_session_id' }),
    )
  })

  it('email existente: NO invita, registra compra con id existente', async () => {
    const admin = makeAdmin({ existingId: 'existing-user' })
    const res = await provisionGuestPurchase(makeSession(), admin)
    expect(res).toEqual({ ok: true, userId: 'existing-user' })
    expect(admin._spies.inviteUserByEmail).not.toHaveBeenCalled()
    expect(admin._spies.upsert).toHaveBeenCalled()
  })

  it('sin email: devuelve ok:false no-email, sin invitar ni insertar', async () => {
    const admin = makeAdmin({})
    const res = await provisionGuestPurchase(makeSession({ customer_details: { email: null } as any }), admin)
    expect(res).toEqual({ ok: false, reason: 'no-email' })
    expect(admin._spies.upsert).not.toHaveBeenCalled()
  })

  it('carrera "already registered": re-lookup encuentra el user y registra compra', async () => {
    const admin = makeAdmin({ existingId: null, inviteUser: null, inviteError: { message: 'already been registered' }, reFetchId: 'raced-user' })
    const res = await provisionGuestPurchase(makeSession(), admin)
    expect(res).toEqual({ ok: true, userId: 'raced-user' })
    expect(admin._spies.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'raced-user' }),
      expect.anything(),
    )
  })
})
```

- [ ] **Step 2: Ejecutar test — debe fallar**

Run: `npx vitest run __tests__/unit/provision-guest.test.ts`
Expected: FAIL con "Cannot find module '@/utils/checkout/provision-guest'".

- [ ] **Step 3: Implementar el helper**

Crear `utils/checkout/provision-guest.ts`:

```ts
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ProvisionResult = { ok: true; userId: string } | { ok: false; reason: string };

/**
 * Provisiona una compra de invitado: resuelve (o crea) el usuario Supabase a
 * partir del email de la sesión de Stripe y registra la compra en
 * course_purchases. Idempotente: reintentos de Stripe encuentran al usuario ya
 * creado y no duplican la compra (upsert on stripe_session_id). Un fallo de
 * envío del email de invitación NO impide registrar la compra si el usuario
 * llegó a crearse (re-lookup por email).
 *
 * `admin` debe ser un cliente Supabase con service role (bypassa RLS).
 */
export async function provisionGuestPurchase(
  session: Stripe.Checkout.Session,
  admin: SupabaseClient,
): Promise<ProvisionResult> {
  const email = session.customer_details?.email?.toLowerCase();
  const courseId = session.metadata?.courseId;
  if (!email) return { ok: false, reason: 'no-email' };
  if (!courseId) return { ok: false, reason: 'no-course' };

  // 1. ¿Usuario existente? (profiles.email lo pobla el trigger handle_new_user)
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let userId: string | undefined = existing?.id;

  // 2. Crear + invitar si es nuevo
  if (!userId) {
    const redirectTo = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/auth/callback?next=/reset-password`;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (invited?.user?.id) {
      userId = invited.user.id;
    } else {
      // Carrera: otra entrega ya creó el user (o el email falló pero el user existe).
      const { data: reFetched } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      userId = reFetched?.id;
      if (!userId) {
        return { ok: false, reason: `invite-failed:${inviteError?.message ?? 'unknown'}` };
      }
    }
  }

  // 3. Registrar compra (idempotente sobre stripe_session_id)
  const { error: purchaseError } = await admin
    .from('course_purchases')
    .upsert(
      {
        user_id: userId,
        course_id: courseId,
        stripe_session_id: session.id,
        amount_paid: session.amount_total ?? null,
      },
      { onConflict: 'stripe_session_id', ignoreDuplicates: true },
    );
  if (purchaseError) return { ok: false, reason: `purchase-error:${purchaseError.message}` };

  // 4. Vincular stripe_customer_id si viene y no está puesto
  if (session.customer) {
    await admin
      .from('profiles')
      .update({ stripe_customer_id: session.customer as string })
      .eq('id', userId)
      .is('stripe_customer_id', null);
  }

  return { ok: true, userId };
}
```

- [ ] **Step 4: Ejecutar test — debe pasar**

Run: `npx vitest run __tests__/unit/provision-guest.test.ts`
Expected: PASS (4 casos).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → 0 errores.
```bash
git add utils/checkout/provision-guest.ts __tests__/unit/provision-guest.test.ts
git commit -m "feat(checkout): helper provisionGuestPurchase (find-or-create user + registra compra)"
```

---

### Task 2: Rama anónima en `/api/checkout`

**Files:**
- Modify: `app/api/checkout/route.ts` (reescritura del cuerpo del `try`)
- Test: `__tests__/api/checkout.test.ts` (añadir bloque guest)

**Interfaces:**
- Produces: `POST /api/checkout` acepta peticiones sin sesión cuando hay `courseId` → crea Checkout Session guest (sin customer, `metadata:{courseId, guest:'1'}`, éxito `/gracias`). Sin sesión y sin `courseId` → sigue devolviendo 401.

- [ ] **Step 1: Test guest (falla primero)**

Añadir al final de `__tests__/api/checkout.test.ts`:

```ts
describe('POST /api/checkout — guest (sin sesión)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: null } })
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { title: 'Curso', price_eur: 199, is_published: true }, error: null }),
    })
    mockSessionCreate.mockResolvedValue({ id: 'cs_guest', url: 'https://checkout.stripe.com/guest' })
  })

  it('sin sesión pero con courseId: crea sesión guest y devuelve url', async () => {
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ courseId: 'course-1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://checkout.stripe.com/guest')
    const arg = mockSessionCreate.mock.calls[0][0]
    expect(arg.customer).toBeUndefined()
    expect(arg.metadata).toEqual({ courseId: 'course-1', guest: '1' })
    expect(arg.success_url).toContain('/gracias?session_id=')
    expect(mockCustomerCreate).not.toHaveBeenCalled()
  })

  it('sin sesión y sin courseId: sigue devolviendo 401', async () => {
    const { POST } = await import('@/app/api/checkout/route')
    const res = await POST(makeRequest({ priceId: 'price_test' }))
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `npx vitest run __tests__/api/checkout.test.ts`
Expected: FAIL (rama guest aún no existe; la primera aserción no se cumple).

- [ ] **Step 3: Reescribir el cuerpo del `try` en `app/api/checkout/route.ts`**

Sustituir el bloque que va desde `const { data: { user } } = await supabase.auth.getUser();` hasta el `return NextResponse.json({ error: 'Falta courseId' }, { status: 400 });` (todo el interior del `try`, dejando intactos el rate-limit de arriba y el `catch` de abajo) por:

```ts
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { courseId } = await req.json() as { courseId?: string };

    // Guest checkout: se permite comprar sin sesión SI hay courseId.
    // Sin sesión y sin courseId no hay nada que hacer.
    if (!user && !courseId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Origin canónico para success_url (asertado en prod). Un Origin malicioso
    // no debe poder redirigir tras el pago.
    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? '';

    if (!courseId) {
      return NextResponse.json({ error: 'Falta courseId' }, { status: 400 });
    }

    // Datos públicos del curso (RLS permite leer publicados sin sesión).
    const { data: course } = await supabase
      .from('courses')
      .select('title, price_eur, is_published')
      .eq('id', courseId)
      .eq('is_published', true)
      .single();

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }
    if (!course.price_eur || course.price_eur <= 0) {
      return NextResponse.json({ error: 'Este curso no tiene precio configurado' }, { status: 400 });
    }
    if (course.price_eur > 10000) {
      return NextResponse.json({ error: 'Precio del curso inválido' }, { status: 400 });
    }

    const lineItems = [{
      price_data: {
        currency: STRIPE_CONFIG.CURRENCY,
        unit_amount: Math.round(course.price_eur * 100),
        product_data: { name: course.title },
      },
      quantity: 1,
    }];

    if (user) {
      // ── Comprador logueado: reutiliza/crea customer y marca userId ──────────
      const supabaseAdmin = createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();

      let customerId: string | undefined = profile?.stripe_customer_id ?? undefined;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        });
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
          const { data: existing } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();
          customerId = existing?.stripe_customer_id ?? customer.id;
        }
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        billing_address_collection: 'auto',
        line_items: lineItems,
        mode: 'payment',
        success_url: `${origin}/profile?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/courses/${courseId}`,
        metadata: { userId: user.id, courseId },
      });

      return NextResponse.json({ sessionId: session.id, url: session.url });
    }

    // ── Comprador invitado (sin cuenta): Stripe recoge el email ───────────────
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      customer_creation: 'always',
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/curso-bachatango`,
      metadata: { courseId, guest: '1' },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
```

(Los imports en el head del archivo — `createClient`, `createSupabaseAdmin`, `stripe`, `STRIPE_CONFIG`, `NextResponse`, rate-limit — ya existen y no cambian.)

- [ ] **Step 4: Ejecutar test — debe pasar**

Run: `npx vitest run __tests__/api/checkout.test.ts`
Expected: PASS (incluye los casos previos + los 2 guest nuevos).

- [ ] **Step 5: Typecheck/lint + commit**

Run: `npx tsc --noEmit` (0 err) y `npx eslint app/api/checkout/route.ts` (0 err).
```bash
git add app/api/checkout/route.ts __tests__/api/checkout.test.ts
git commit -m "feat(checkout): rama anónima guest (sin customer, success /gracias)"
```

---

### Task 3: Rama guest en el webhook

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts` (bloque `if (!userId)`)
- Test: `__tests__/api/webhooks.test.ts` (añadir caso guest)

**Interfaces:**
- Consumes: `provisionGuestPurchase` (Task 1).

- [ ] **Step 1: Test guest (falla primero)**

Añadir a `__tests__/api/webhooks.test.ts`. Primero, mockear el helper cerca de los otros `vi.mock` del archivo (arriba):

```ts
const mockProvision = vi.fn()
vi.mock('@/utils/checkout/provision-guest', () => ({
  provisionGuestPurchase: (...args: unknown[]) => mockProvision(...args),
}))
```

Y añadir el caso (dentro del describe de `checkout.session.completed`, o uno nuevo):

```ts
it('guest (sin userId, guest=1, paid): provisiona y responde 200', async () => {
  mockProvision.mockResolvedValue({ ok: true, userId: 'guest-user' })
  mockConstructEvent.mockReturnValue({
    type: 'checkout.session.completed',
    data: { object: makeSession({ metadata: { courseId: 'course-1', guest: '1' }, payment_status: 'paid' }) },
  })
  const { POST } = await import('@/app/api/webhooks/stripe/route')
  const res = await POST(makeWebhookRequest())
  expect(res.status).toBe(200)
  expect(mockProvision).toHaveBeenCalled()
})

it('guest con provisión fallida por DB: responde 500 (Stripe reintenta)', async () => {
  mockProvision.mockResolvedValue({ ok: false, reason: 'purchase-error:boom' })
  mockConstructEvent.mockReturnValue({
    type: 'checkout.session.completed',
    data: { object: makeSession({ metadata: { courseId: 'course-1', guest: '1' }, payment_status: 'paid' }) },
  })
  const { POST } = await import('@/app/api/webhooks/stripe/route')
  const res = await POST(makeWebhookRequest())
  expect(res.status).toBe(500)
})
```

(Asegúrate de que `makeSession` en este archivo acepta `metadata` en overrides; si el helper local `makeSession` no lo permite, extiéndelo para incluir `metadata` y `payment_status`.)

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `npx vitest run __tests__/api/webhooks.test.ts`
Expected: FAIL (hoy un session sin `userId` devuelve 400).

- [ ] **Step 3: Modificar el webhook**

En `app/api/webhooks/stripe/route.ts`, añadir el import cerca de los demás:

```ts
import { provisionGuestPurchase } from '@/utils/checkout/provision-guest';
```

Sustituir el bloque actual:

```ts
    if (!userId) {
      console.error('Webhook: missing userId in metadata');
      return new NextResponse('Missing userId', { status: 400 });
    }
```

por:

```ts
    if (!userId) {
      // Guest checkout: no hay userId; se provisiona por email tras el pago.
      if (session.metadata?.guest === '1' && courseId && session.payment_status === 'paid') {
        const result = await provisionGuestPurchase(session, supabase);
        if (!result.ok) {
          console.error('Webhook: guest provisioning failed:', result.reason);
          // Falta de email/curso → no reintentar (200). Errores de DB/invite → 500.
          if (result.reason === 'no-email' || result.reason === 'no-course') {
            return new NextResponse(null, { status: 200 });
          }
          return new NextResponse('Provisioning Error', { status: 500 });
        }
        return new NextResponse(null, { status: 200 });
      }
      console.error('Webhook: missing userId in metadata');
      return new NextResponse('Missing userId', { status: 400 });
    }
```

(El resto del handler — la rama con `userId` para compra/suscripción — no cambia.)

- [ ] **Step 4: Ejecutar test — debe pasar**

Run: `npx vitest run __tests__/api/webhooks.test.ts`
Expected: PASS (casos previos + guest 200 + guest 500).

- [ ] **Step 5: Typecheck/lint + commit**

Run: `npx tsc --noEmit` (0 err) y `npx eslint app/api/webhooks/stripe/route.ts` (0 err).
```bash
git add app/api/webhooks/stripe/route.ts __tests__/api/webhooks.test.ts
git commit -m "feat(checkout): webhook provisiona compra guest (sin userId)"
```

---

### Task 4: Página `/gracias`

**Files:**
- Create: `app/gracias/page.tsx`, `app/gracias/gracias.module.css`
- Test: `__tests__/api/gracias.test.ts`

**Interfaces:**
- Consumes: `stripe` de `@/utils/stripe/server`.
- Produces: ruta `/gracias?session_id=...`. Server component.

- [ ] **Step 1: Test (falla primero)**

Crear `__tests__/api/gracias.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRetrieve = vi.fn()
vi.mock('@/utils/stripe/server', () => ({
  stripe: { checkout: { sessions: { retrieve: mockRetrieve } } },
}))

import GraciasPage from '@/app/gracias/page'

beforeEach(() => vi.clearAllMocks())

describe('/gracias', () => {
  it('sesión pagada: muestra el email del comprador', async () => {
    mockRetrieve.mockResolvedValue({ payment_status: 'paid', customer_details: { email: 'buyer@example.com' } })
    const el = await GraciasPage({ searchParams: Promise.resolve({ session_id: 'cs_1' }) })
    const html = JSON.stringify(el)
    expect(html).toContain('buyer@example.com')
  })

  it('sin session_id: mensaje neutro, no llama a Stripe', async () => {
    const el = await GraciasPage({ searchParams: Promise.resolve({}) })
    expect(mockRetrieve).not.toHaveBeenCalled()
    expect(el).toBeTruthy()
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `npx vitest run __tests__/api/gracias.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar la página**

Crear `app/gracias/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { stripe } from '@/utils/stripe/server';
import styles from './gracias.module.css';

export const metadata: Metadata = {
  title: 'Gracias por tu compra',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function GraciasPage(props: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await props.searchParams;

  let email: string | null = null;
  let paid = false;
  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      paid = session.payment_status === 'paid';
      email = session.customer_details?.email ?? null;
    } catch {
      // sesión inválida/expirada → mensaje neutro
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {paid ? (
          <>
            <h1 className={styles.title}>¡Pago recibido! 🎉</h1>
            <p className={styles.body}>
              {email
                ? <>Te hemos enviado un email a <strong>{email}</strong> para crear tu acceso al curso.</>
                : <>Te hemos enviado un email para crear tu acceso al curso.</>}
            </p>
            <p className={styles.hint}>Revisa tu bandeja de entrada (y la carpeta de spam). Pulsa el enlace para fijar tu contraseña y entrar.</p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Gracias</h1>
            <p className={styles.body}>Si has completado un pago, en breve recibirás un email con tu acceso.</p>
            <p className={styles.hint}>¿Algún problema? Escríbenos desde la página de contacto.</p>
          </>
        )}
        <a href="/curso-bachatango" className={styles.link}>Volver</a>
      </div>
    </div>
  );
}
```

Crear `app/gracias/gracias.module.css`:

```css
.wrap { min-height: 70vh; display: flex; align-items: center; justify-content: center; padding: var(--spacing-2xl) var(--page-pad); background: #050505; }
.card { max-width: 560px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--spacing-2xl); }
.title { font: var(--h2); color: var(--primary); margin-bottom: var(--spacing-lg); }
.body { font: var(--body); font-size: 1.1rem; color: var(--text-main); margin-bottom: var(--spacing-md); }
.hint { font: var(--small); color: var(--text-muted); margin-bottom: var(--spacing-lg); }
.link { display: inline-block; color: var(--primary); text-decoration: underline; font: var(--small); }
```

- [ ] **Step 4: Ejecutar test — debe pasar**

Run: `npx vitest run __tests__/api/gracias.test.ts`
Expected: PASS (2 casos).

- [ ] **Step 5: Typecheck/lint + commit**

Run: `npx tsc --noEmit` (0 err) y `npx eslint app/gracias/` (0 err).
```bash
git add app/gracias/page.tsx app/gracias/gracias.module.css __tests__/api/gracias.test.ts
git commit -m "feat(checkout): página /gracias tras pago guest"
```

---

### Task 5: `CourseCtaButton` siempre a checkout + link login

**Files:**
- Modify: `app/curso-bachatango/_components/CourseCtaButton.tsx`
- Modify: `app/curso-bachatango/_components/LandingHero.tsx`
- Modify: `app/curso-bachatango/_components/StickyBuyBar.tsx`
- Modify: `app/curso-bachatango/_components/LandingSections.tsx`
- Modify: `app/curso-bachatango/page.tsx`
- Test: `__tests__/components/course-cta-button.test.tsx` (actualizar), `__tests__/components/landing-hero.test.tsx` (extender)

**Interfaces:**
- Produces: `CourseCtaButton` props `{ courseId: string; label: string; className?: string }` (se elimina `isAuthed`). `StickyBuyBar`/`LandingSections` props `{ courseId, price }` (sin `isAuthed`). `LandingHero` conserva `{ courseId, isAuthed, price, imageUrl }` (usa `isAuthed` para el link de login).

- [ ] **Step 1: Actualizar el test del botón (rojo)**

Reemplazar el contenido de `__tests__/components/course-cta-button.test.tsx` por:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/curso-bachatango',
}))

import CourseCtaButton from '@/app/curso-bachatango/_components/CourseCtaButton'

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'location', { value: { assign: vi.fn(), href: '' }, writable: true })
})

describe('CourseCtaButton', () => {
  it('siempre llama a /api/checkout y redirige a la url de Stripe', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://checkout.stripe.com/x' }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<CourseCtaButton courseId="c1" label="Comprar" />)
    fireEvent.click(screen.getByRole('button', { name: 'Comprar' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/checkout', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('https://checkout.stripe.com/x'))
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

Run: `npx vitest run __tests__/components/course-cta-button.test.tsx`
Expected: FAIL (el componente aún exige `isAuthed` y ramifica a signup).

- [ ] **Step 3: Simplificar `CourseCtaButton`**

Reemplazar `app/curso-bachatango/_components/CourseCtaButton.tsx` por:

```tsx
'use client';

import { useState } from 'react';
import styles from '../page.module.css';

interface CourseCtaButtonProps {
  courseId: string;
  label: string;
  className?: string;
}

export default function CourseCtaButton({ courseId, label, className }: CourseCtaButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'No se pudo iniciar el pago');
      }
      window.location.assign(data.url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error(err);
      alert('Error: ' + message);
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={handleClick} disabled={loading} className={`${styles.cta} ${className ?? ''}`}>
      {loading ? 'Procesando…' : label}
    </button>
  );
}
```

- [ ] **Step 4: Quitar `isAuthed` de los consumidores del botón**

En `app/curso-bachatango/_components/StickyBuyBar.tsx`: cambiar la interfaz a `interface StickyProps { courseId: string; price: number }`, quitar `isAuthed` de la desestructuración, y en el `<CourseCtaButton>` quitar `isAuthed={isAuthed}` (dejar `courseId` y `label`).

En `app/curso-bachatango/_components/LandingSections.tsx`: cambiar la interfaz a `interface SectionsProps { courseId: string; price: number }`, quitar `isAuthed`, y en las dos apariciones de `<CourseCtaButton>` quitar `isAuthed={isAuthed}`.

En `app/curso-bachatango/page.tsx`: en `<LandingSections>` y `<StickyBuyBar>` quitar la prop `isAuthed={isAuthed}` (dejar `courseId`/`price`). Mantener `isAuthed={isAuthed}` SOLO en `<LandingHero>`.

- [ ] **Step 5: Añadir link "inicia sesión" en el Hero (test rojo)**

Extender `__tests__/components/landing-hero.test.tsx` con un caso:

```tsx
  it('muestra link de login cuando no está autenticado', () => {
    render(<LandingHero courseId="c1" isAuthed={false} price={199} imageUrl={null} />)
    expect(screen.getByRole('link', { name: /Inicia sesión/i })).toHaveAttribute('href', '/login')
  })

  it('no muestra link de login cuando está autenticado', () => {
    render(<LandingHero courseId="c1" isAuthed={true} price={199} imageUrl={null} />)
    expect(screen.queryByRole('link', { name: /Inicia sesión/i })).toBeNull()
  })
```

- [ ] **Step 6: Implementar el link en `LandingHero`**

En `app/curso-bachatango/_components/LandingHero.tsx`, dentro del `<div className={styles.heroInner}>`, tras `<p className={styles.heroMicro}>{c.micro}</p>`, añadir:

```tsx
        {!isAuthed && (
          <p className={styles.heroLogin}>
            ¿Ya tienes cuenta? <a href="/login">Inicia sesión</a>
          </p>
        )}
```

Y en el `<CourseCtaButton>` del Hero quitar `isAuthed={isAuthed}` (dejar `courseId`/`label`). Mantener el prop `isAuthed` en `HeroProps` (se usa para el link).

Añadir a `app/curso-bachatango/page.module.css`:

```css
.heroLogin { margin-top: var(--spacing-md); font: var(--small); color: var(--text-muted); }
.heroLogin a { color: var(--primary); text-decoration: underline; }
```

- [ ] **Step 7: Ejecutar tests — deben pasar**

Run: `npx vitest run __tests__/components/course-cta-button.test.tsx __tests__/components/landing-hero.test.tsx`
Expected: PASS.

- [ ] **Step 8: Typecheck/lint + suite + commit**

Run: `npx tsc --noEmit` (0 err), `npm run lint` (0 err en archivos de la rama), `npx vitest run` (toda la suite verde).
```bash
git add app/curso-bachatango/ __tests__/components/course-cta-button.test.tsx __tests__/components/landing-hero.test.tsx
git commit -m "feat(checkout): CTA siempre a checkout + link login para invitados"
```

---

## Self-Review (autor del plan)

**Spec coverage:**
- `/api/checkout` rama anónima → Task 2.
- `provisionGuestPurchase` (find-or-create + invite + upsert + idempotencia + carrera + sin-email) → Task 1.
- Webhook rama guest (200/500 según motivo) → Task 3.
- `/gracias` verifica sesión y muestra email → Task 4.
- `CourseCtaButton` siempre a checkout + link login → Task 5.
- Invite `redirectTo=/auth/callback?next=/reset-password` → Task 1 (helper) — la verificación del flujo set-password→curso queda para pruebas manuales post-merge (nota abajo).

**Placeholder scan:** sin TBD/TODO; todo el código está completo.

**Type consistency:** `ProvisionResult`/`provisionGuestPurchase(session, admin)` consistente entre Task 1 y su uso en Task 3. `CourseCtaButton {courseId,label,className?}` consistente entre Task 5 y todos sus consumidores. `StickyProps/SectionsProps {courseId,price}` y `HeroProps {courseId,isAuthed,price,imageUrl}` consistentes con page.tsx.

**Nota de verificación manual (post-merge, no automatizable aquí):** compra guest real end-to-end → email de invitación → fijar contraseña en `/reset-password` → acceso a `/courses/{COURSE_ID}`. Depende de SMTP propio configurado en Supabase (requisito operativo del spec).
