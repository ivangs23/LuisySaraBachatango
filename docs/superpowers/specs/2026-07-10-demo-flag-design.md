# Spec 4 — Flag `is_demo` para datos de prueba

**Fecha:** 2026-07-10
**Estado:** Diseño aprobado (pendiente revisión de spec)
**Depende de:** Spec 3 (modo demo, rama `feat/demo-mode`).

## Objetivo

Marcar todo lo creado por el modo demo (compras y usuarios) con un flag, para poder **borrarlo luego** sin tocar los datos reales de producción.

## Cambios

### 1. Migración — `supabase/2026_07_demo_flag.sql` (crear)
```sql
alter table course_purchases
  add column if not exists is_demo boolean not null default false;
```

### 2. `utils/checkout/provision-guest.ts` (modificar)
- Firma nueva: `provisionGuestPurchase(session, admin, opts?: { isDemo?: boolean })`.
- El upsert de `course_purchases` incluye `is_demo: true` **solo cuando `opts?.isDemo === true`**. Cuando no (rama real), la clave `is_demo` **no se incluye** en el payload → la columna usa su default `false`. Esto hace que el webhook real siga funcionando aunque la migración no esté aplicada.
- Al crear usuario nuevo (`inviteUserByEmail`) en demo, pasar `data: { is_demo: true }` en las options → marca `user_metadata.is_demo` del auth user. Rama real invita sin ese `data`.
- Usuario ya existente que compra en demo: su compra queda `is_demo=true`, pero su cuenta NO se re-marca (es real).

### 3. `app/demo-checkout/actions.ts` (modificar)
- `simulatePurchase` llama `provisionGuestPurchase(session, admin, { isDemo: true })`.

### 4. Webhook y rama logueada
- Sin cambios. El webhook guest llama `provisionGuestPurchase(session, admin)` (sin opts → `is_demo` false). La rama logueada de `/api/checkout`+webhook hace su propio upsert sin `is_demo` → default false.

### 5. Limpieza — `supabase/cleanup_demo_data.sql` (crear, documentación ejecutable)
```sql
-- Borra los datos creados en modo demo. Revisa antes de ejecutar.
delete from course_purchases where is_demo = true;
delete from auth.users
  where (raw_user_meta_data->>'is_demo')::boolean is true; -- cascada a profiles y compras restantes
```

## Rollout

- La migración es **prerrequisito solo del modo demo**: la rama real omite la clave `is_demo`, así que desplegar este código **no rompe** producción aunque la migración no esté aplicada.
- El modo demo escribe en la BD Supabase del entorno (hoy la de producción). Aplicar la migración en esa BD (SQL editor de Supabase o CLI) **antes de usar el demo**. La aplica el dueño (no hay acceso DDL desde aquí).

## Testing

- `provisionGuestPurchase` (unit):
  - con `opts={isDemo:true}` y email nuevo → `inviteUserByEmail` llamado con `data:{is_demo:true}`; el upsert incluye `is_demo:true`.
  - sin opts (o `isDemo` falsy) → invite SIN `data.is_demo`; el payload del upsert NO incluye la clave `is_demo`.
  - los casos existentes (email existente, sin email, carrera, 23505 idempotente) siguen pasando.
- `simulatePurchase` (unit): llama `provisionGuestPurchase` con tercer arg `{ isDemo: true }`.

## Fuera de alcance

- Botón/endpoint admin de limpieza (se usa el SQL documentado).
- Retención/expiración automática de datos demo.
- Flag en `subscriptions` (el demo solo hace compra one-time).

## Supuestos

- La migración se aplica en la BD antes de usar el demo.
- `inviteUserByEmail(email, { data, redirectTo })` guarda `data` en `user_metadata` (`raw_user_meta_data`).
