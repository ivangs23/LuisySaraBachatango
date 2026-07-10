# Spec 2 — Guest Checkout (pago→cuenta) para la landing

**Fecha:** 2026-07-09
**Estado:** Diseño aprobado (pendiente revisión de spec)
**Depende de:** Spec 1 (landing `/curso-bachatango`, ya en producción).

## Objetivo

Un visitante frío sin cuenta puede **comprar el curso pagando directamente** (sin registro previo). La cuenta se crea/vincula **tras el pago** vía el webhook de Stripe, y el comprador recibe un email de invitación para fijar contraseña y acceder al curso. Elimina la fricción del flujo interino actual (CTA logout → `/signup` → email de confirmación → dashboard, sin volver al pago).

## Producto / contexto (real)

- Curso: `COURSE_ID = 'f89a576f-4a77-40f7-93e9-23e6c820ee92'`, `complete`, one-time, €199 (precio desde BD).
- Stripe **LIVE ya activo** en producción; webhook live `we_1TrDqT…` → `/api/webhooks/stripe`, evento `checkout.session.completed` suscrito.
- `course_purchases`: `user_id uuid NOT NULL` (FK auth.users), `course_id`, `stripe_session_id NOT NULL`, `amount_paid`, `UNIQUE(user_id, course_id)`. RLS: INSERT solo service-role (webhook).
- Trigger `on_auth_user_created` → `handle_new_user()` auto-crea `profiles` al crear un auth user. `profiles.email` existe (poblado desde auth.users) → lookup por email trivial.
- Emails de Supabase Auth ya operativos (flujo forgot-password usa `redirectTo` + `/auth/callback`). El whitelist `isSafeRedirect` (`app/auth/callback/redirect.ts`) incluye `/courses`.

## Decisiones aprobadas

1. **Acceso post-pago:** `supabase.auth.admin.inviteUserByEmail(email, { redirectTo })` — crea el user y envía email; el comprador fija contraseña y queda logueado. Cuenta con contraseña real.
2. **CTA logout:** guest checkout directo (siempre POST `/api/checkout`; el server decide authed vs guest) + link pequeño "¿Ya tienes cuenta? Inicia sesión" (solo si `!isAuthed`).
3. **Enfoque A:** la provisión (crear/vincular user + registrar compra) ocurre en el **webhook** (fuente única de verdad, idempotente). `/gracias` solo verifica la sesión para mostrar confirmación; no provisiona.

## Arquitectura y flujo

```
Visitante frío → CTA → POST /api/checkout (sin sesión)
  → Stripe Checkout (recoge email + tarjeta) → paga
  → success_url /gracias?session_id={CHECKOUT_SESSION_ID}   ("revisa tu email")
  → webhook checkout.session.completed (metadata sin userId, guest:'1'):
       provisionGuestPurchase(session):
         email = session.customer_details.email
         user  = (profiles por email) ?? inviteUserByEmail(email)
         upsert course_purchases {user_id, course_id, stripe_session_id, amount_paid}
         set profiles.stripe_customer_id
  → email invitación (Supabase) → fija contraseña → /courses/{COURSE_ID}
```

## Componentes (unidades con límites claros)

### 1. `/api/checkout` — rama anónima (modificar `app/api/checkout/route.ts`)
- Hoy: `if (!user) return 401`. Nuevo: si no hay sesión **y** hay `courseId`, seguir por la **rama guest** en vez de rechazar.
- Guest Checkout Session: `mode: 'payment'`, mismo `price_data` dinámico (valida curso publicado + `price_eur` 0<p≤10000 como ahora), **sin** `customer`, `metadata: { courseId, guest: '1' }` (sin `userId`), `success_url: ${origin}/gracias?session_id={CHECKOUT_SESSION_ID}`, `cancel_url: ${origin}/curso-bachatango`.
- Stripe Checkout recoge el email automáticamente (`customer_details.email` en el webhook).
- Mantiene rate-limit por IP existente.
- Logueado: rama actual intacta (metadata `userId`, success `/profile`).

### 2. `provisionGuestPurchase(session)` — helper testeable (crear `utils/checkout/provision-guest.ts`)
Firma: `async function provisionGuestPurchase(session: Stripe.Checkout.Session, admin: SupabaseClient): Promise<{ ok: true } | { ok: false; reason: string }>`.
Lógica:
1. `email = session.customer_details?.email?.toLowerCase()`. Si falta → devolver `{ok:false, reason:'no-email'}` (el caller loguea y responde 200 para no reintentar en bucle).
2. Buscar user: `select id from profiles where email = email`. Si existe → `userId = id` (no re-invitar).
3. Si no existe → `inviteUserByEmail(email, { redirectTo: ${BASE_URL}/auth/callback?next=/reset-password })`. `userId = data.user.id`. Enviar invite (Supabase). Si el invite falla con "already been registered" (carrera con otra entrega) → re-lookup por email y usar ese id.
4. `upsert course_purchases {user_id, course_id: session.metadata.courseId, stripe_session_id: session.id, amount_paid: session.amount_total}` idempotente (mismo patrón que la rama logueada).
5. Si `session.customer` → set `profiles.stripe_customer_id` (para el user resuelto) si null.
- **Idempotencia:** reintentos de Stripe → user encontrado por email → no re-invita; upsert de compra no duplica. Devuelve `{ok:true}` siempre que la compra quede registrada.

### 3. Webhook — rama guest (modificar `app/api/webhooks/stripe/route.ts`)
- En `checkout.session.completed`, si `!userId` y `session.metadata?.guest === '1'` y hay `courseId` y `payment_status === 'paid'` → llamar `provisionGuestPurchase(session, supabase)`.
  - `{ok:true}` → 200. `{ok:false}` → loguear el motivo y **200** (no reintentar indefinidamente por falta de email); un error real de DB → 500 (Stripe reintenta).
- El `if (!userId) return 400` actual se sustituye por: authed (userId) → flujo actual; guest (guest flag) → provisión; ninguno → loguear + 400 (payload inesperado).

### 4. `/gracias` — página de confirmación (crear `app/gracias/page.tsx`)
- Server component. Lee `session_id` de `searchParams`.
- `stripe.checkout.sessions.retrieve(session_id)` → si `payment_status==='paid'`, mostrar: "¡Pago recibido! Te enviamos un email a **{customer_details.email}** para crear tu acceso. Revisa tu bandeja (y spam)."
- Si la sesión no existe / no pagada → mensaje neutro + link a soporte/contacto.
- Ruta libre (`/gracias` no ocupada). Sin datos sensibles (la sesión de Stripe es efímera y el id viene en la URL de éxito).

### 5. `CourseCtaButton` — simplificar (modificar `app/curso-bachatango/_components/CourseCtaButton.tsx`)
- Quitar la rama `router.push('/signup')`. **Siempre** POST `/api/checkout` con `{courseId}` y redirigir a `data.url`. El server decide authed vs guest.
- El prop `isAuthed` deja de usarse para el flujo del botón; se puede eliminar del botón. El link "¿Ya tienes cuenta? Inicia sesión" (a `/login`) lo renderiza el Hero/Sections bajo el CTA cuando `!isAuthed` (usa el `isAuthed` que ya baja del server component). Actualizar el test del botón: ambos casos ahora llaman a `/api/checkout`.

### 6. Invite → set-password → curso
- `redirectTo` del invite: `/auth/callback?next=/reset-password`. El usuario fija contraseña en `/reset-password` (flujo existente) y luego navega/rediralige al curso `/courses/${COURSE_ID}`. Verificar en el plan que `/reset-password` acepta la sesión de invite (token type `invite`/`recovery`) y que tras fijar contraseña se puede enviar a `/courses/${COURSE_ID}` (prefijo `/courses` ya en el whitelist).

## Manejo de errores y casos borde

- **Email ya registrado (cliente con cuenta compra deslogueado):** lookup por `profiles.email` lo encuentra → se vincula la compra a su cuenta, sin invite duplicado. Puede iniciar sesión normalmente para acceder. (Opcional futuro: enviarle un magic link para uniformar "revisa tu email").
- **Carrera de entregas del webhook:** invite lanza "already registered" → re-lookup por email → usar id existente. Upsert de compra idempotente.
- **Sin email en la sesión** (no debería pasar; Checkout siempre lo recoge): loguear + 200.
- **Fallo de envío de invite (SMTP):** loguear el error con el email; la compra queda registrada igualmente; `/gracias` ofrece "reenviar acceso" y hay ruta de soporte. NO devolver 500 solo por fallo de email (la compra ya es válida).
- **Reembolso/chargeback:** fuera de alcance.

## ⚠️ Requisito operativo (responsabilidad del dueño)

El acceso depende del **email de invitación de Supabase**. El SMTP por defecto de Supabase tiene límite bajo (~3-4/hora) y baja entregabilidad. **Antes de vender con volumen, configurar SMTP propio** (Resend/SendGrid/Postmark) en Supabase → Auth → SMTP. Sin esto, invites fallan y compradores pagan sin acceso. El webhook loguea fallos; `/gracias` da red con "reenviar acceso".

## Testing

- **`provisionGuestPurchase`** (unit, mocks de Supabase admin + Stripe):
  - email nuevo → `inviteUserByEmail` llamado, compra insertada con el id devuelto.
  - email existente (en `profiles`) → NO invita, compra insertada con el id existente.
  - sin email → `{ok:false, reason:'no-email'}`, sin invite ni insert.
  - reintento idempotente → segunda llamada no duplica compra ni re-invita.
  - carrera "already registered" → re-lookup + insert.
- **`/api/checkout` rama guest** (unit): sin sesión + courseId → crea Checkout Session sin customer, metadata `{courseId, guest:'1'}`, success `/gracias`. Curso no publicado / sin precio → 404/400 como ahora.
- **Webhook guest** (unit): `checkout.session.completed` guest paid → llama `provisionGuestPurchase` y responde 200; error DB → 500.
- **`/gracias`** (unit): con sesión pagada → muestra email; sin `session_id` o sesión no pagada → mensaje neutro.

## Fuera de alcance

- Reembolsos/chargebacks; magic-link para clientes existentes (opcional futuro); i18n de `/gracias` y del email; configurar el SMTP (responsabilidad operativa); cambios en el precio o en el modelo de suscripción.

## Supuestos

- Supabase Auth con SMTP configurado (propio en prod) — el dueño lo asume.
- `/reset-password` + `/auth/callback` existentes sirven para el flujo de invite (a verificar en el plan).
- Stripe Checkout recoge siempre el email del comprador.
