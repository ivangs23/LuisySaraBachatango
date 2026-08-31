-- ============================================================================
-- Newsletter: prueba de consentimiento (RGPD art. 7.1) y soporte de baja.
--
-- Estado al escribir esto (2026-08-12): la tabla tiene 0 filas, así que el
-- backfill de abajo es un no-op. Se deja porque la migración debe seguir
-- siendo correcta si se aplica más tarde, con suscriptores ya dentro.
--
-- Idempotente: se puede reejecutar sin daño. No borra ni modifica datos
-- existentes — solo añade columnas y rellena las nuevas.
-- ============================================================================

alter table public.newsletter_subscribers
  add column if not exists consent_ip text,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_source text;

-- Backfill: las filas existentes se suscribieron sin registro de prueba.
-- Se sella su consent_at con la fecha de alta y se marca el origen como
-- 'legacy' para poder distinguirlas en una auditoría.
update public.newsletter_subscribers
   set consent_at = coalesce(consent_at, subscribed_at),
       consent_source = coalesce(consent_source, 'legacy')
 where consent_source is null;

-- Las bajas se consultan por email en cada intento de alta.
create index if not exists newsletter_subscribers_unsubscribed_idx
  on public.newsletter_subscribers (unsubscribed_at)
  where unsubscribed_at is not null;

-- ============================================================================
-- VALIDACIÓN — ejecutar después:
--
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'newsletter_subscribers'
--   order by ordinal_position;
--
-- Deben aparecer consent_ip, consent_at y consent_source.
-- ============================================================================
