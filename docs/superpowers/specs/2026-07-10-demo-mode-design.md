# Spec 3 — Modo Demo (simular pago) con switch a producción

**Fecha:** 2026-07-10
**Estado:** Diseño aprobado (pendiente revisión de spec)
**Depende de:** Spec 2 (guest checkout, ya en main).

## Objetivo

Permitir probar **a mano** el flujo de compra completo (web + landing `/curso-bachatango`, guest y logueado) **simulando el pago** (sin cobro real de Stripe), sobre un deploy preview/staging o local. Un switch (`DEMO_MODE`) activa el modo demo; al quitarlo, **todo vuelve a producción** (Stripe real). El modo demo **nunca** puede activarse en el dominio de producción real.

## Principio de seguridad (define el diseño)

Un modo demo que simula el pago concede acceso a cursos sin cobrar. Si estuviera activo en el dominio real con público → cursos gratis para cualquiera. Por eso:

- El switch es una **env var de servidor** (`DEMO_MODE`), no un toggle de usuario/BD.
- **Doble guard** que hace el demo imposible en producción, aunque alguien ponga la env var por error:
  - `VERCEL_ENV === 'production'` → demo OFF siempre.
  - `NEXT_PUBLIC_BASE_URL` contiene `luisysarabachatango.com` → demo OFF siempre.
- Fail-safe: por defecto (sin `DEMO_MODE=true`) todo es Stripe real y las rutas demo devuelven 404.

## Switch — `isDemoMode()`

Crear `utils/demo/mode.ts`:

```ts
export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE !== 'true') return false;
  if (process.env.VERCEL_ENV === 'production') return false;
  if ((process.env.NEXT_PUBLIC_BASE_URL ?? '').includes('luisysarabachatango.com')) return false;
  return true;
}
```

- **Local** (`VERCEL_ENV` undefined) + `DEMO_MODE=true` → demo ON.
- **Preview** (`VERCEL_ENV='preview'`) + `DEMO_MODE=true` → demo ON.
- **Prod** (`VERCEL_ENV='production'` o dominio real) → demo OFF pase lo que pase.

Switch = poner/quitar `DEMO_MODE=true` en el env del preview (flip = redeploy del preview, trivial en Vercel). Es server-only; nunca se expone al cliente salvo el efecto visible (banner + rutas demo).

## Flujo demo (reusa toda la maquinaria de guest checkout)

```
CTA (CourseCtaButton, sin cambios) → POST /api/checkout
   isDemoMode()?  → devuelve { url: `/demo-checkout?courseId=<id>` }   (corta ANTES de Stripe)
   else           → Stripe real (comportamiento actual intacto)

/demo-checkout?courseId=... (server component):
   if !isDemoMode() → notFound()
   fetch curso (título, precio, publicado) → render <DemoCheckoutForm> (email prellenado si hay sesión)

simulatePurchase(formData)  (server action):
   guard: if !isDemoMode() → notFound()/redirect('/')   (defensa en profundidad)
   email = form email (o email de la sesión si logueado); courseId = form
   sesión sintética: { id:`demo_${randomUUID()}`, customer_details:{email}, metadata:{courseId}, amount_total: precio*100, customer:null }
   provisionGuestPurchase(sesiónSintética, admin)   ← MISMA función que el webhook real
   redirect('/gracias?demo=1&email=<email>')
```

- **Reusa `provisionGuestPurchase` sin tocarlo**: find-or-create user por email, invite si es nuevo, upsert `course_purchases` idempotente (`stripe_session_id = demo_<uuid>`), backfill customer (null en demo → no-op).
- Sirve para **guest** (email nuevo → invite real) y **logueado** (email = su cuenta → encuentra user, sin invite; registra la compra).
- El **webhook no se toca** (demo no lo usa).

## `/gracias` — rama demo (afordancia para probar sin depender del email)

Modificar `app/gracias/page.tsx`: si `isDemoMode()` y `searchParams.demo === '1'` y hay `email`:
- No llama a Stripe (la sesión es sintética).
- Muestra: "MODO DEMO — pago simulado para {email}" + el **link directo de fijar contraseña**, generado en servidor con el cliente admin:
  `admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: `${BASE_URL}/auth/callback?next=/reset-password` } })` → mostrar `properties.action_link`.
- Así se completa el flujo (fijar contraseña → curso) **sin esperar el email SMTP**.
- Fuera de demo, esa rama no se ejecuta (la lógica Stripe actual queda intacta). El `email`/link solo se renderizan si `isDemoMode()` (en prod `isDemoMode()` es false → nunca).

## Banner global

Crear `components/DemoBanner.tsx` (server component simple). En `app/layout.tsx`, renderizar `{isDemoMode() && <DemoBanner />}` arriba del `<Header>`. Texto: "⚠️ MODO DEMO — los pagos son simulados, no se cobra nada". Oculto en prod (guard).

## Componentes (unidades)

- `utils/demo/mode.ts` — `isDemoMode()` (crear).
- `app/api/checkout/route.ts` — rama demo al principio del manejo de `courseId` (modificar).
- `app/demo-checkout/page.tsx` — página de pago simulado (crear).
- `app/demo-checkout/actions.ts` — `simulatePurchase` (crear).
- `components/DemoCheckoutForm.tsx` — form cliente (crear).
- `app/gracias/page.tsx` — rama demo (modificar).
- `components/DemoBanner.tsx` + `app/layout.tsx` — banner (crear + modificar).
- `.env.local.example` — documentar `DEMO_MODE` (modificar).

## Errores y casos borde

- Petición a `/demo-checkout` o `simulatePurchase` cuando NO es demo → `notFound()` / redirect (nunca provisiona fuera de demo).
- `simulatePurchase` sin email → error de validación en el form (email requerido).
- Idempotencia: recompra demo del mismo curso/email → `provisionGuestPurchase` ya lo maneja (23505 → ok).
- `generateLink` falla (SMTP/config) → mostrar mensaje "cuenta creada; revisa tu email" sin romper (la compra ya está registrada).
- El `email` en query de `/gracias` es del propio tester en un deploy no-prod → aceptable (no PII de terceros; nunca en prod).

## Testing

- `isDemoMode()` (unit): matriz `DEMO_MODE` {true,false} × `VERCEL_ENV` {'production','preview',undefined} × dominio prod vs otro. En particular: `DEMO_MODE=true` + `VERCEL_ENV='production'` → **false**; `DEMO_MODE=true` + dominio real → **false**.
- `/api/checkout` (unit): con `isDemoMode()` true → devuelve `{ url: '/demo-checkout?courseId=...' }`, NO llama a `stripe.checkout.sessions.create`; con demo false → Stripe (comportamiento actual, sin regresión).
- `simulatePurchase` (unit): guard rechaza cuando no demo (no provisiona); en demo llama a `provisionGuestPurchase` con sesión sintética (email/courseId correctos) y redirige a `/gracias?demo=1`.
- `/demo-checkout` page (unit): `notFound()` cuando `!isDemoMode()`.
- `/gracias` demo (unit): en demo con `?demo=1&email=` muestra email y (mock) link; sin demo, rama Stripe intacta.

## Fuera de alcance

- Toggle en runtime sin redeploy (el switch es env var; flip = redeploy del preview).
- Demo en el dominio de producción real (prohibido por diseño).
- Simular suscripciones (solo compra de curso one-time).
- Sembrar/limpiar datos demo automáticamente.

## Supuestos

- Se usará en un deploy **preview** de Vercel (o local), no en el dominio prod.
- `provisionGuestPurchase` (Spec 2) está en main y no cambia.
- `DEMO_MODE` NUNCA se pone en el env de producción (y aunque se pusiera, el guard lo neutraliza).
