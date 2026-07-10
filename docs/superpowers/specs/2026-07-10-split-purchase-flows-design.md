# Spec 5 — Separar flujos de compra (web vs landing) + origen

**Fecha:** 2026-07-10
**Estado:** Diseño aprobado (pendiente revisión de spec)
**Depende de:** guest checkout (Spec 2), demo mode (Spec 3), flag is_demo (Spec 4) — todo en main.

## Objetivo

Que la **web normal** y la **landing** tengan flujos de compra **independientes**:
- **Web normal** (`/courses/[id]`): el visitante anónimo **se registra primero**, luego compra logueado. NO guest checkout.
- **Landing** (`/curso-bachatango`): **formulario propio** (nombre + email) → paga → damos de alta al usuario + email de acceso.
- Cada compra queda marcada con su **origen** (`source`: `'web'` | `'landing'`) en `course_purchases`.

Hoy ambos comparten `/api/checkout` y la rama guest "bleedeó" a la web normal. Este spec los separa.

## Topología

```
WEB NORMAL  /courses/[id]  →  requiere cuenta
   BuyCourseButton:
     sin sesión → router.push('/signup?next=/courses/[id]')   (registro primero)
     con sesión → POST /api/checkout → Stripe (o simula en demo) → /profile
   /api/checkout: EXIGE sesión (401 anónimo). metadata/compra source:'web'.

LANDING  /curso-bachatango  →  guest con formulario propio
   CourseCtaButton: LINK → /curso-bachatango/comprar?courseId=…
   /curso-bachatango/comprar (página): formulario nombre + email
   acción landingCheckout(formData):
     demo → provisionGuestPurchase(sesión sintética con metadata) {isDemo,source:'landing',fullName} → /gracias?demo=1
     real → Stripe Checkout Session (customer_email prefijado, metadata {courseId,guest:'1',source:'landing',fullName}) → Stripe (tarjeta) → /gracias
   Webhook (checkout.session.completed, guest): provisionGuestPurchase con {source, fullName} desde metadata.
```

## Modo demo en AMBOS flujos ("probar toda la web y landing")

- **Landing (guest):** `landingCheckout` en demo → `provisionGuestPurchase` sintético (crea cuenta + `is_demo` + `source:'landing'`) → `/gracias?demo=1` (con link set-password).
- **Web (logueado):** `/api/checkout` en demo → **simula** para el usuario logueado: inserta `course_purchases {user_id, course_id, source:'web', is_demo:true}` directamente (sin Stripe) y devuelve `{ url: '/courses/<id>' }` (curso ya desbloqueado). Fuera de demo → Stripe real.
- En preview (Stripe test) el flujo web real usaría tarjetas test; la simulación demo lo hace instantáneo. En prod, demo está OFF (guard) → siempre Stripe real.

## Componentes

### 1. Migración `supabase/2026_07_source.sql` (crear)
```sql
alter table course_purchases add column if not exists source text;
```
(Nullable. La rama que no lo setea omite la clave → no rompe sin migración, igual que `is_demo`.)

### 2. `utils/checkout/provision-guest.ts` (modificar)
- `opts` gana `source?: string` y `fullName?: string`.
- El upsert incluye `source` solo si `opts.source` está presente (patrón `is_demo`).
- El invite pasa `data` con `full_name` (si `fullName`) y `is_demo:true` (si demo) → el trigger `handle_new_user` copia `full_name` a `profiles`.

### 3. `/api/checkout` `app/api/checkout/route.ts` (modificar — WEB ONLY)
- Quitar la rama guest anónima y la rama demo→/demo-checkout.
- Sin sesión → `401`.
- Con sesión:
  - demo → insertar `course_purchases {user_id, course_id, source:'web', is_demo:true}` (upsert idempotente) → `{ url: '/courses/'+courseId }`.
  - real → Stripe Checkout Session (customer reuse existente), `metadata:{ userId, courseId, source:'web' }`, success `/profile`. La rama logueada del webhook añade `source:'web'` a su upsert.

### 4. Web normal — ya gateado por login (sin cambios de UI)
- Hallazgo: `app/courses/[courseId]/page.tsx` renderiza `CoursePreviewShell` (preview + CTA login) para anónimos; `BuyCourseButton` solo se muestra en la rama autenticada. Por tanto el flujo web YA es "regístrate/login primero → compra logueado".
- `BuyCourseButton` NO necesita cambios (ni prop `isAuthed`): siempre lo pulsa un usuario logueado → POST `/api/checkout`. El origen `source:'web'` lo pone el servidor.
- (Verificar que `CoursePreviewShell` lleva a login/registro; si solo dice "login", basta — la página de login enlaza a signup.)

### 5. `/curso-bachatango/comprar` (crear página + form)
- `app/curso-bachatango/comprar/page.tsx` (server): valida `courseId` publicado (`notFound()` si no); prefill email/nombre si hay sesión; render `<LandingCheckoutForm courseId defaultEmail defaultName>`.
- `components/LandingCheckoutForm.tsx` (client): campos `nombre` + `email` (required) → `<form action={landingCheckout}>` + hidden courseId. Estética de la landing.

### 6. `landingCheckout` acción `app/curso-bachatango/comprar/actions.ts` (crear)
- `landingCheckout(formData)`: lee courseId, fullName, email (lowercase). Valida curso publicado + precio.
- demo (`isDemoMode()`) → sesión sintética `{ id:'demo_<uuid>', customer_details:{email}, metadata:{courseId, source:'landing', fullName}, amount_total }` → `provisionGuestPurchase(session, admin, { isDemo:true, source:'landing', fullName })` → `redirect('/gracias?demo=1&email='+enc)`.
- real → `stripe.checkout.sessions.create({ customer_email: email, line_items:[price_data], mode:'payment', metadata:{ courseId, guest:'1', source:'landing', fullName }, success_url: /gracias?session_id=…, cancel_url: /curso-bachatango })` → `redirect(session.url)`.

### 7. `CourseCtaButton` `app/curso-bachatango/_components/CourseCtaButton.tsx` (modificar)
- Pasa de botón-fetch a **link**: renderiza `<a href={'/curso-bachatango/comprar?courseId='+courseId} className={cta}>{label}</a>`. Sin fetch, sin `isDemoMode` aquí.
- Consumidores (Hero/Sticky/Sections) sin cambios de props relevantes.

### 8. Webhook `app/api/webhooks/stripe/route.ts` (modificar)
- Rama guest: `provisionGuestPurchase(session, supabase, { source: session.metadata?.source, fullName: session.metadata?.fullName })`.
- Rama logueada (compra): su upsert añade `source: session.metadata?.source ?? 'web'`.

### 9. Consolidación del demo (retirar lo redundante)
- **Eliminar** `app/demo-checkout/` (page + actions `simulatePurchase`) y su test — su rol lo asume `/curso-bachatango/comprar` + `landingCheckout` (rama demo).
- Quitar de `/api/checkout` la rama `if isDemoMode() return {url:'/demo-checkout'}`.
- `/gracias` rama demo: sin cambios (link set-password para sesión propia).

## Casos borde / errores

- Web anónimo → siempre a `/signup` (nunca guest). Web logueado sin curso válido → 404 (como ahora).
- Landing form sin nombre/email → validación (required en el form; la acción revalida y redirige con error si falta).
- Curso no publicado en `landingCheckout` → redirect a `/curso-bachatango` con error.
- `source`/`fullName` ausentes en metadata (compat) → `provisionGuestPurchase` omite la clave `source`; `full_name` queda null.
- Idempotencia: sin cambios (upsert on stripe_session_id / 23505).

## Testing

- `provisionGuestPurchase`: con `{source:'landing', fullName:'X'}` → upsert incluye `source`; invite `data` incluye `full_name`. Sin source → clave ausente. (Casos previos siguen.)
- `/api/checkout`: anónimo → 401; logueado real → Stripe con `source:'web'`; logueado demo → inserta compra `source:'web',is_demo:true` y devuelve `/courses/<id>` (sin Stripe).
- `BuyCourseButton`: `!isAuthed` → push `/signup?next=`; `isAuthed` → POST checkout.
- `landingCheckout`: demo → provisionGuestPurchase con `{isDemo,source:'landing',fullName}`; real → Stripe con metadata correcta.
- `/curso-bachatango/comprar` page: `notFound()` si curso ausente; render del form.
- Webhook: guest → source/fullName de metadata; logueado → source:'web'.

## Fuera de alcance

- Cambiar el precio/producto. Reporting/panel de origen (el `source` queda en BD para consultas SQL). i18n del form de compra.

## Prerrequisito operativo

Aplicar `supabase/2026_07_source.sql` en la BD antes de reportar origen (la rama que no lo usa no se rompe sin ella). Igual que `is_demo`.

## Punto a confirmar en revisión

La **simulación demo del flujo web** (sección "Modo demo en ambos flujos") no estaba explícita en la topología aprobada. Si prefieres que el flujo web en demo use Stripe **test** (no simulación instantánea), se quita esa rama de `/api/checkout` y el demo queda solo en la landing. Marcar preferencia al revisar.
