-- ============================================================================
-- La contraseña deja de pedirse en el formulario de compra.
--
-- Once campos obligatorios antes de pagar dejaban fuera a 54 de cada 62
-- personas que llegaban al formulario (medido 2026-08-31 → 2026-09-09). La
-- cuenta pasa a crearse sin contraseña y el alumno la fija desde el correo de
-- confirmación, que es el camino que este mismo código ya usaba para recuperar
-- compras huérfanas (utils/checkout/provision-registration.ts:56-61).
--
-- La columna NO se borra: las compras en vuelo cuando se despliegue esto
-- todavía traen su hash, y provisionFromPending lo sigue aceptando.
--
-- Idempotente.
-- ============================================================================

alter table public.pending_registrations
  alter column password_hash drop not null;

-- ============================================================================
-- VALIDACIÓN — ejecutar después:
--
--   select is_nullable from information_schema.columns
--    where table_schema='public' and table_name='pending_registrations'
--      and column_name='password_hash';            → YES
-- ============================================================================
