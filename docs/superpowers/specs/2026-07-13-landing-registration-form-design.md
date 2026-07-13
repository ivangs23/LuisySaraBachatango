# Spec 8 — Formulario de registro completo en la landing (cuenta creada solo tras pago)

**Fecha:** 2026-07-13
**Estado:** Diseño aprobado a alto nivel (pendiente revisión de spec)
**Depende de:** guest checkout (Spec 2), demo/test mode (Spec 3/7), split flows (Spec 5) — todo en main.

## Objetivo

Ampliar el formulario de compra de la landing (`/curso-bachatango/comprar`) para recoger **todos** los datos de registro del comprador, pero **sin crear la cuenta ni enviar ningún email hasta que Stripe confirme el pago** (modelo "todo en el form, provisión post-pago").

Campos nuevos: contraseña + repetir (segura), país, ciudad, fecha de nacimiento, nivel de baile, teléfono (opcional), consentimiento marketing (opcional), aceptar términos (obligatorio).

Este spec incorpora una revisión de seguridad adversarial (fuga de contraseña, cuenta-sin-pago, account-takeover, enumeración de usuarios, minteo de cuentas en preview, purga de pagos tardíos). Los puntos marcados **[MUST]** son requisitos de seguridad no negociables.

## Decisión de arquitectura (aprobada por el usuario)

Recoger todo en el form; **no** crear usuario ni mandar emails hasta que el pago se complete. Implementación: guardar el registro pendiente en una tabla `pending_registrations` con la **contraseña hasheada (bcrypt, no reversible)**; el webhook de Stripe (pago confirmado) crea la cuenta desde esa fila y la borra.

## Campos del formulario (landing, español)

| Campo | Tipo | Requerido | Validación |
|---|---|---|---|
| `fullName` | text | Sí | no vacío |
| `email` | email | Sí | `EMAIL_RE` |
| `password` | password | Sí | **mín 8 + mayúscula + minúscula + número** |
| `repeatPassword` | password | Sí | debe coincidir con `password` |
| `country` | select | Sí | valor dentro de allowlist (`utils/i18n/countries.ts`) |
| `city` | text | Sí | no vacío, longitud razonable |
| `dateOfBirth` | date | Sí | fecha válida pasada, **edad 16–100** |
| `danceLevel` | select | Sí | `principiante` \| `intermedio` \| `avanzado` |
| `phone` | tel | No | si presente, formato teléfono válido |
| `marketingConsent` | checkbox | No | booleano (opt-in, sin marcar por defecto) |
| `acceptTerms` | checkbox | **Sí** | debe estar marcado; enlaces a términos/privacidad |

Validación en cliente (UX) **y** servidor (autoridad), vía un validador compartido `utils/checkout/registration-validation.ts`. Reutiliza `MIN_PASSWORD_LENGTH` (`utils/auth/password.ts`) y promueve `EMAIL_RE` a `utils/auth/email.ts` para compartir con `landingCheckout` y `signup`.

**[MUST]** Los campos de contraseña **nunca** se rehidratan tras un error de validación (no viajan en `searchParams`/`defaultValue`). Solo `email`, `fullName`, `courseId` pueden re-echoarse.

## Datos (migraciones nuevas)

### `supabase/2026_07_pending_registrations.sql`
```sql
create table if not exists public.pending_registrations (
  id uuid primary key default gen_random_uuid(),   -- token (pendingId)
  email text not null,
  full_name text,
  password_hash text not null,                       -- bcrypt, NUNCA plaintext
  country text,
  city text,
  date_of_birth date,
  phone text,
  marketing_consent boolean not null default false,
  dance_level text,
  course_id uuid,
  amount_expected integer,                           -- céntimos, para bind con amount_total
  created_at timestamptz not null default now()
);
create index if not exists pending_registrations_created_at_idx
  on public.pending_registrations (created_at);

alter table public.pending_registrations enable row level security;
-- Sin acceso público: anon/authenticated NO pueden nada. service_role tiene
-- BYPASSRLS (la usa el webhook/landing action). Políticas deny explícitas y
-- autodocumentadas (idioma del repo).
create policy "pending_registrations_no_select" on public.pending_registrations for select using (false);
create policy "pending_registrations_no_insert" on public.pending_registrations for insert with check (false);
create policy "pending_registrations_no_update" on public.pending_registrations for update using (false);
create policy "pending_registrations_no_delete" on public.pending_registrations for delete using (false);
```

### `supabase/2026_07_profiles_landing_columns.sql`
```sql
alter table public.profiles
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists date_of_birth date,
  add column if not exists phone text,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists dance_level text;
```
El trigger `handle_new_user` (2026_05_audit2) solo inserta `id/email/full_name` → estas columnas nacen NULL y **las rellena el provisionador con un UPDATE separado** tras `createUser` (mismo patrón que `stripe_customer_id`). **[MUST]** El `password_hash` **jamás** se escribe en `profiles` (RLS de profiles es `select using(true)`, mundo-legible).

## Contraseña en reposo (verificado)

**[MUST]** Guardar en `pending_registrations.password_hash` **solo un hash bcrypt** (cost ≥ 12, formato `$2a/$2b`). Añadir dependencia **`bcryptjs`** (JS puro, sin binarios nativos). El provisionador llama `supabase.auth.admin.createUser({ email, password_hash, email_confirm: true, user_metadata: { full_name } })`.

Verificado en este repo: `@supabase/auth-js@2.105.3` expone `AdminUserAttributes.password_hash` y su doc dice *"Supports bcrypt, scrypt (firebase), and argon2 password hashes"* (types.d.ts:476-482). No se usa AES ni una nueva `APP_ENCRYPTION_KEY`: bcrypt es unidireccional → una fuga de `pending_registrations` solo expone hashes; AES sería reversible (fuga BD + clave = plaintext) y peor.

## Flujo

```
FORM (landing) → landingCheckout(formData)
  1. rate-limit por IP (10/min, ya existe) + [MUST] rate-limit por email/día
  2. validar TODOS los campos (validador compartido) → si falla, redirect ?error=<code> (password NUNCA re-echoada)
  3. resolver curso publicado + precio (como hoy)
  4. bcrypt-hash de la contraseña en una const local; [MUST] descartar el plaintext acto seguido
  5. insertar fila pending_registrations {..., password_hash, course_id, amount_expected}
     (validar+dedupe ANTES de insertar; INSERT justo antes de crear la sesión)
  6. Stripe Checkout Session:
       client_reference_id = pendingId            ← portador del token (no metadata)
       metadata = { courseId, source:'landing', pendingId }   (compat; SIN password)
       customer_email = email
     [MUST] whitelist de args: ningún campo derivado de la contraseña en ningún campo Stripe
  7. redirect a session.url   (o demo/test → provisión inline, ver abajo)

WEBHOOK checkout.session.completed  (rama guest/landing)
  Detección (compat rollout): metadata.guest==='1'  OR  client_reference_id/pendingId presente
  [MUST] provisionar SOLO si session.payment_status === 'paid'
  [MUST] AND session.amount_total === pending.amount_expected (del curso); si no → log + HTTP 200, sin provisión
  Provisión idempotente (resolve-or-create):
    a. SELECT profiles by email
    b. si NO existe → admin.createUser({ email, password_hash, email_confirm:true, user_metadata:{full_name} })
       - si createUser devuelve "already exists" → re-SELECT profiles by email y continuar (NUNCA 500)
    c. si YA existía la cuenta → [MUST] adjuntar la compra pero NO tocar password ni email;
       descartar el password_hash pendiente; NO pisar country/city/dob/phone existentes.
    d. si es cuenta nueva → UPDATE profiles SET country,city,date_of_birth,phone,marketing_consent,dance_level (columnas enumeradas)
    e. course_purchases upsert onConflict:'stripe_session_id' ignoreDuplicates; swallow 23505 UNIQUE(user,course) como éxito idempotente
    f. DELETE pending_registrations row (consumo primario) — [MUST] última operación de datos, tras confirmar la compra
    g. enviar email de confirmación vía Resend — [MUST] estrictamente al final y exactamente una vez (gated en upsert().select() devolviendo insert real)
```

### Orden estricto (idempotencia + seguridad)
`resolve-or-create user → UPDATE profiles (solo cuenta nueva, columnas enumeradas) → upsert course_purchases (commit) → DELETE pending (último dato) → email Resend (último, gated)`. Si el pending no se encuentra para una sesión pagada (reintento tras éxito) → tratar como ya provisionado (idempotente), no error.

## Modo demo / test (provisión inline)

El path demo/test construye la fila pending + provisiona inline (simula el webhook) para probar sin Stripe con todos los campos, usando **el mismo provisionador idempotente** (hash→createUser({password_hash}), sin atajo de plaintext).

**[MUST]** Como este path **crea cuentas reales con contraseña**, blindar el minteo distinguiendo **qué disparó** el modo test:
- Si el disparador es la **cookie HMAC de admin** (`readTestCookie` true): provisión permitida en cualquier entorno, incl. prod (es el test legítimo del admin, Spec 7 — la cuenta queda `is_demo`, borrable).
- Si el disparador es **`isDemoMode()`** (auto-true en preview/development, sin cookie admin): provisión permitida **solo si el ref del proyecto Supabase destino NO es el de producción**. Si `isDemoMode()` apunta a la BD de prod (preview mal configurado que heredó `SUPABASE_URL`/`SERVICE_ROLE_KEY` de prod) → **[MUST] refuse** (no crear cuenta). Ante entorno/ref desconocido, fail-closed (no provisionar).
- Envolver el path inline en try/catch → `?error=` limpio + consumir/borrar la fila pending en éxito y en fallo manejado.

Implementación del guard: un helper que reciba (disparador: 'cookie'|'env', refDestino) y devuelva si puede escribir usuarios. El ref de prod es conocido (`jytokoxbsykoyifzbjkd`); compararlo contra el ref extraído de `NEXT_PUBLIC_SUPABASE_URL`.

Racional: `isDemoMode()` es auto-true en cualquier preview/development de Vercel; un preview que herede por error las credenciales de prod permitiría al form anónimo mintear cuentas reales login-ready en la BD de prod. Separar "disparó cookie admin" (confiable, cualquier BD) de "disparó isDemoMode" (solo BD no-prod) cierra el agujero sin romper el test legítimo del admin en prod.

## Email de confirmación (tras pago)

Antes del pago: **ningún** email. Tras provisión exitosa (cuenta nueva): email "compra confirmada, ya tienes acceso — entra con la contraseña que elegiste" vía Resend (dominio ya verificado, Spec SMTP). No hace falta email de set-password (el comprador eligió su contraseña).

Cuenta ya existente (comprador recurrente): email "tu compra está lista — entra con tu cuenta habitual (recupera tu contraseña aquí si la olvidaste)". **No** se envía set-password ni se cambia su contraseña.

## Manejo de email ya registrado (cambio vs diseño presentado)

En el diseño presentado dije "si el email ya tiene cuenta → error 'ya tienes cuenta, inicia sesión'". La revisión de seguridad lo **corrige** por dos motivos:
- **Account-takeover [MUST]:** si un implementador "arreglara" el fallo de createUser-existente llamando a `updateUserById` para fijar la contraseña tecleada, un atacante que meta el email de una víctima + su propia contraseña + pague, tomaría la cuenta de la víctima. Por eso: en cuenta existente **nunca** se fija/pisa la contraseña ni el email.
- **Enumeración de usuarios [MUST]:** un error inline distintivo "ya tienes cuenta" es un oráculo de existencia. En su lugar, respuesta genérica indistinguible de un alta nueva; el comprador recurrente recibe su aviso por email tras pagar.

Resultado UX: un comprador recurrente que teclea una contraseña nueva en la landing **conserva su contraseña anterior** (la tecleada se ignora), recibe la compra y un email para entrar/recuperar. Caso poco frecuente en tráfico frío de landing; se prioriza no-takeover.

## Rate limiting y abuso pre-pago

**[MUST]** Mantener el throttle por IP (10/min) **y** añadir un límite por email/día. Validar y deduplicar **antes** de insertar la fila pending; diferir el INSERT a justo antes de crear la sesión. Cap de filas por email y por IP. Racional: el INSERT pre-pago es anónimo y solo throttled por IP → una IP puede generar 14.400 filas/día acumulando PII + hashes bcrypt (superficie de cracking offline).

## Limpieza de `pending_registrations`

- Consumo primario: DELETE de la fila en la provisión exitosa.
- **[MUST]** Suscribir `checkout.session.expired` en el mismo webhook → DELETE de la fila pending.
- Purga automática de filas huérfanas (impago) con **TTL consciente de settlement**, cómodamente por encima de la ventana de reintentos/settlement de Stripe (algunos métodos liquidan días después). Mecanismo: ruta programada (Vercel cron) o `pg_cron`, TTL ~30 días. **No** basarse solo en un script on-demand (rara vez se ejecuta → acumula credenciales+PII). Un TTL ingenuo de 7 días arriesga descartar un pago tardío → dinero-sin-acceso.

## Logging / Sentry

**[MUST]** Nunca `console.log/error` de la `FormData`, el plaintext ni el payload pendiente. Hashear en const local y descartar el plaintext. El repo usa Sentry → añadir un scrubber `beforeSend`/`beforeSendTransaction` que elimine claves `password`, `repeatPassword`, `password_hash`. Cualquier lectura admin de `pending_registrations` debe restringir columnas para excluir `password_hash`.

## Rollout / compatibilidad

**[MUST]** Durante la ventana de migración mantener **ambos** detectores de rama guest: `metadata.guest==='1'` (existente) **y** el nuevo `pendingId`/`client_reference_id`. Mantener el guard `payment_status==='paid'`. Retirar el detector legacy solo cuando todas las sesiones en vuelo pre-deploy hayan liquidado o expirado (si no, un pago-tras-deploy de una sesión antigua se perdería).

## Códigos de error (nuevos) + i18n

`landingCheckout` redirige a `?error=<code>` con: `invalid_email`, `password_too_short`, `password_weak`, `password_mismatch`, `invalid_phone`, `invalid_country`, `invalid_birthdate`, `terms_not_accepted`, `account_creation_failed` (+ reutiliza `rate`, `stripe`, `course`, `missing`). Cablear los mensajes en el diccionario de errores de la landing.

**Bonus:** arreglar `minLength={6}` obsoleto del input password de `SignupForm.tsx` para que case con el mínimo de 8 del servidor; no copiar esa inconsistencia al form nuevo.

## Testing

- **Validador** (`registration-validation.ts`): password fuerza/coincidencia, edad 16–100, país allowlist, teléfono, términos obligatorio, email.
- **`landingCheckout`:** inserta pending con `password_hash` (no plaintext); Stripe recibe `client_reference_id=pendingId` y metadata sin password; email duplicado → respuesta genérica (no oráculo); sin términos → error; rate-limit por email. **[MUST]** test que asserta que los args de `create()` (y la sesión sintética demo) no contienen ninguna clave password/repeat/hash.
- **Webhook:** pending→cuenta+perfil (columnas enumeradas)+compra+borrado; idempotencia (doble entrega no duplica cuenta ni compra); email ya existente → adjunta compra sin tocar password; `payment_status!=='paid'` o `amount_total` distinto → sin provisión; `checkout.session.expired` → borra pending.
- **Demo path:** provisiona inline con guard de cookie admin + assert no-prod; sin cookie/prod → no crea cuenta.
- **Provisionador:** createUser "already exists" → re-SELECT, no 500.

## Riesgos abiertos (para implementación)

- Verificar en un entorno real que GoTrue acepta el hash de `bcryptjs` (`$2a/$2b`, cost 12) en `createUser({password_hash})` antes de fiar todo el flujo; si fallara, fallback a `inviteUserByEmail` (sin contraseña en el form) — no a guardar plaintext.
- Doble-cargo-sin-producto: dos filas pending → dos sesiones pagadas con `stripe_session_id` distintos → la 2ª compra colapsa por el path 23505 sin segundo grant. Emitir log/alerta distintivo etiquetando ese `stripe_session_id` como candidato a reembolso.
- `email_confirm:true` marca el email verificado sin prueba de posesión (email squatting). Se acepta el riesgo: el comprador pagó con tarjeta (intención probada) y el email de confirmación avisa al dueño real si hubo squatting. Alternativa (fuera de alcance): usar el email post-pago como paso de activación.
- Definir el valor concreto del TTL de purga contra la ventana real de settlement asíncrono de Stripe (algunos métodos liquidan días después) para no purgar un pago legítimo tardío.

## Fuera de alcance

- Cambiar el flujo web logueado (`/api/checkout`) o el signup web (salvo el fix cosmético `minLength`).
- Avatar/redes sociales en el form de compra (se editan en perfil).
- Cambiar el precio/promo (Spec 6).
- Migrar compradores antiguos (guest sin estas columnas quedan con NULL, aceptable).

## Prerrequisitos operativos

- `bcryptjs` en `package.json`.
- Aplicar las 2 migraciones (`pending_registrations`, columnas `profiles`) en la BD de producción antes del deploy.
- Programar la purga (Vercel cron o `pg_cron`).
- Confirmar el scrubber de Sentry activo en todos los entornos.
