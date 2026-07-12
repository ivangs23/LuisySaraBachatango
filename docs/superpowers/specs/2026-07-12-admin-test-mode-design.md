# Spec 7 — Modo pruebas activable desde el panel admin (per-navegador)

**Fecha:** 2026-07-12
**Estado:** Diseño aprobado (pendiente revisión de spec)
**Depende de:** demo mode (Spec 3), flag is_demo (Spec 4), split flows (Spec 5) — todo en main.

## Objetivo

Que un admin pueda activar el **modo pruebas** (pago simulado, sin Stripe) en **producción**, desde el panel `/admin`, para probar a mano las compras sin pagar. Requisito de seguridad central: **nunca debe filtrarse a usuarios normales** (jamás un comprador real obtiene el curso gratis).

**Decisiones aprobadas:**
- **Alcance per-navegador:** activar pone una cookie firmada; **solo ese navegador** simula. Cualquier otro visitante paga real siempre. Lo que activa la simulación es la cookie, no el rol → cubre ambos flujos (web logueado y landing guest, incluso deslogueado) en ese navegador.
- **Duración 2h:** la cookie caduca sola a las 2 horas (o al pulsar "desactivar").
- **Mecanismo:** cookie firmada stateless (HMAC-SHA256), sin BD (enfoque A).

## Estado actual

`isDemoMode()` (`utils/demo/mode.ts`) es **solo por entorno**: prod → real siempre; preview/local → demo. Los dos checkouts gatean en él:
- `app/api/checkout/route.ts:54` (web logueado)
- `app/curso-bachatango/comprar/actions.ts:44` (landing guest)

Otros consumidores: `app/layout.tsx:124` (banner), `app/gracias/page.tsx:21` (rama demo del "gracias").

Panel admin: `app/admin/` gated por `requireAdmin()` (`utils/auth/require-admin.ts`), con `AdminSidebar`. HMAC ya se usa en `app/api/webhooks/mux/route.ts` (node `crypto`).

## Arquitectura

Una cookie firmada `lsb_test_mode` es la **capacidad** que activa la simulación. Solo un admin puede emitirla (server action tras `requireAdmin()`). Los checkouts pasan de comprobar `isDemoMode()` (env) a `isTestPurchaseMode()` = `isDemoMode() OR cookie válida`. Sin cookie válida y en prod → siempre Stripe real.

```
ACTIVAR (admin)  /admin/pruebas → enableTestMode()
   requireAdmin()  → si no admin: throw, no cookie
   cookies().set('lsb_test_mode', sign(now+2h), {httpOnly, secure, sameSite:'lax', path:'/', maxAge:7200})

CHECKOUT (cualquiera)  /api/checkout  y  landingCheckout
   if (await isTestPurchaseMode())  → simula (sin Stripe, is_demo:true)
   else                             → Stripe real
   isTestPurchaseMode = isDemoMode() || readTestCookie()
   readTestCookie = verifica firma HMAC (timingSafeEqual) + no caducada

DESACTIVAR (admin)  disableTestMode() → cookies().delete('lsb_test_mode')
```

## Componentes

### 1. `utils/demo/test-mode.ts` (crear)

Firma/verificación de la cookie + lectura + combinador.

- `const TEST_COOKIE = 'lsb_test_mode'`
- `const TEST_TTL_MS = 2 * 60 * 60 * 1000` (2h)
- `function secret(): string | null` → `process.env.TEST_MODE_SECRET ?? null`.
- `function signToken(expiryMs: number): string` → `` `${expiryMs}.${hmac}` `` donde `hmac = createHmac('sha256', secret).update(String(expiryMs)).digest('hex')`. Lanza si no hay secreto (solo se llama desde `enableTestMode`, que ya validó admin).
- `function verifyToken(value: string | undefined): boolean`:
  - Sin secreto → `false` (fail-closed).
  - Parsear `expiryMs.hmac`; si falta o formato inválido → `false`.
  - Recomputar hmac esperado; comparar con `crypto.timingSafeEqual` sobre buffers de igual longitud (si longitudes distintas → `false`).
  - `Number(expiryMs)` válido y `Date.now() < expiryMs` → `true`; si no → `false`.
- `async function readTestCookie(): Promise<boolean>` → `verifyToken((await cookies()).get(TEST_COOKIE)?.value)`.
- `async function isTestPurchaseMode(): Promise<boolean>` → `isDemoMode() || await readTestCookie()`. Importa `isDemoMode` de `./mode` (dependencia unidireccional).
- `const TEST_COOKIE_OPTS` (para set): `{ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: TEST_TTL_MS / 1000 }`. Exportado para reuso en el action.

`isDemoMode()` en `mode.ts` **no cambia** (sigue sync, solo-entorno).

### 2. Cablear checkouts + banner + gracias (modificar)

- `app/api/checkout/route.ts:54` — `if (isDemoMode())` → `if (await isTestPurchaseMode())`. Importar de `@/utils/demo/test-mode`. (El cuerpo de la rama demo no cambia.)
- `app/curso-bachatango/comprar/actions.ts:44` — igual.
- `app/gracias/page.tsx:21` — `isDemoMode()` → `await isTestPurchaseMode()` (page ya es async server component). Import añadido; el existente de `isDemoMode` se sustituye si queda sin uso.
- `app/layout.tsx:124` — `{isDemoMode() && <DemoBanner />}` → `{(await isTestPurchaseMode()) && <DemoBanner />}` (layout ya es async). Import añadido.
- `components/DemoBanner.tsx` — copy a: `⚠️ MODO PRUEBAS — los pagos son simulados, no se cobra nada`. (Cambio de texto; sirve para env-demo y para admin-test.)

### 3. UI admin (crear)

- `app/admin/pruebas/actions.ts` (`'use server'`):
  - `enableTestMode()`: `await requireAdmin()` (throw si no admin) → si `!secret()` lanza/error → `(await cookies()).set(TEST_COOKIE, signToken(Date.now() + TEST_TTL_MS), TEST_COOKIE_OPTS)` → `revalidatePath('/admin/pruebas')` y `revalidatePath('/', 'layout')` (para refrescar el banner).
  - `disableTestMode()`: `await requireAdmin()` → `(await cookies()).delete(TEST_COOKIE)` → `revalidatePath('/admin/pruebas')` y `revalidatePath('/', 'layout')`.
- `app/admin/pruebas/page.tsx` (server): `await requireAdmin()` implícito por el layout; lee estado con `readTestCookie()` + expiry (lee la cookie, parsea `expiryMs` para mostrar restante). Renderiza explicación + `<TestModeToggle active expiresAt>`. `export const dynamic = 'force-dynamic'`.
- `components/admin/TestModeToggle.tsx` (client): botón **Activar pruebas** (form action `enableTestMode`) o **Desactivar** (form action `disableTestMode`) según `active`; muestra estado y, si activo, tiempo restante (countdown a partir de `expiresAt`). Estilo consistente con el panel.
- `components/admin/AdminSidebar.tsx` (modificar): añadir entrada "Modo pruebas" → `/admin/pruebas`.

### 4. Env var + operativo

- **`TEST_MODE_SECRET`** (nueva): 32 bytes aleatorios en hex. Añadir a Vercel (production + preview + development) y a `.env.local`. La genera y sube el asistente por API (como se hizo con otras claves).
- Fail-closed: si falta, `verifyToken` → false y `enableTestMode` da error → el modo pruebas simplemente no se activa; checkout sigue real. Sin secreto, cero riesgo.

## Seguridad (requisito central)

- La cookie es **httpOnly** → inaccesible por JS (no se puede setear vía XSS ni leer desde cliente).
- **Firmada** (HMAC-SHA256 con `TEST_MODE_SECRET`) → no forjable sin el secreto del servidor. Comparación **constant-time** (`timingSafeEqual`).
- Solo se **emite** tras `requireAdmin()` → un no-admin nunca la obtiene. Un usuario normal jamás tiene la cookie → jamás paga simulado.
- **Doble cota temporal:** `expiryMs` embebido y firmado (no manipulable) + `maxAge` de la cookie. A las 2h deja de valer aunque el navegador la conserve.
- **secure + sameSite=lax**, `path=/`.
- **Fail-closed** si falta el secreto.
- La cookie NO confía en el rol en el momento del checkout: la cookie ES la prueba de que un admin la emitió. Esto es lo que permite probar el flujo guest (deslogueado) de forma segura.

## Casos borde

- Cookie manipulada (hmac o expiry alterados) → `verifyToken` false (hmac no cuadra).
- Cookie caducada (>2h) → false, aunque siga en el navegador.
- Sin `TEST_MODE_SECRET` → feature inerte (nunca simula), activar muestra error.
- Admin activa, cierra sesión, abre la landing en el mismo navegador → cookie sigue → landing simula (esperado; es el caso de uso guest).
- Otro visitante (sin cookie) en prod → Stripe real siempre.
- Preview/local → `isDemoMode()` ya es true por entorno; la cookie es irrelevante ahí (sigue simulando como hoy).

## Testing

- `test-mode.ts` (unit): `signToken`→`verifyToken` roundtrip OK; expirado→false; hmac manipulado→false; expiry manipulado→false; ausente/vacía→false; sin secreto→false; longitudes distintas→false (sin excepción de `timingSafeEqual`).
- `isTestPurchaseMode`: env-demo true→true; cookie válida (mock `cookies`)→true; ninguna→false.
- `enableTestMode`/`disableTestMode`: no-admin (`requireAdmin` throw)→no setea cookie; admin→setea/borra con opciones correctas (mock `cookies` + `requireAdmin`); sin secreto→error, no cookie.
- `/api/checkout` y `landingCheckout`: con `isTestPurchaseMode()` mockeado true→toma rama simula; false en prod→Stripe. (Se mockea el combinador, no el entorno.)
- Banner: `app/layout` muestra `<DemoBanner>` cuando `isTestPurchaseMode()` true.
- `TestModeToggle`: render activo vs inactivo (botón correcto).

## Fuera de alcance

- Revocación global de "todas las sesiones test" (rotar `TEST_MODE_SECRET` lo hace; innecesario per-navegador 2h).
- Tabla/auditoría en BD de quién activó (enfoque B, descartado).
- Toggle global o solo-admin (descartados por seguridad/utilidad en brainstorming).
- Cambiar el borrado de compras demo (`is_demo` + `cleanup_demo_data.sql` ya existen).

## Prerrequisito operativo

Definir `TEST_MODE_SECRET` en Vercel (3 entornos) y `.env.local` antes de usar el modo pruebas. Sin él, la feature queda inerte (fail-closed).
