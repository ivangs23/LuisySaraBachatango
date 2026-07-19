-- supabase/2026_07_fix1_refunds.sql
-- AUDITORIA-2026-07 A3: los reembolsos y disputas de Stripe no revocaban el
-- acceso al curso — course_purchases nunca se marcaba y hasCourseAccess (y las
-- policies RLS) concedían acceso por mera existencia de fila.
--
-- Aplicar ANTES que 2026_07_fix2_security_hardening.sql (fix2 referencia
-- refunded_at en sus policies).
--
-- Decisión de producto (2026-07): solo el reembolso TOTAL o una disputa
-- revocan; un reembolso parcial (gesto comercial) mantiene el acceso.
-- Una disputa ganada (dispute.closed status=won) restaura el acceso.

alter table public.course_purchases
  add column if not exists refunded_at timestamptz,
  add column if not exists stripe_payment_intent text;

-- El handler del webhook localiza la compra por payment_intent.
create index if not exists idx_course_purchases_pi
  on public.course_purchases (stripe_payment_intent);

-- ============================================================================
-- La policy RLS de lessons concede acceso por compra: debe ignorar compras
-- reembolsadas. Recreada desde 2026_05_audit4_rls_lessons_null_guard.sql
-- (la versión vigente) añadiendo SOLO `and cp.refunded_at is null`.
-- ============================================================================
drop policy if exists "Lessons SELECT: free, admin, purchased or subscribed." on lessons;

create policy "Lessons SELECT: free, admin, purchased or subscribed." on lessons
  for select using (
    coalesce(is_free, false) = true
    or exists (
      select 1 from profiles
      where id = (select auth.uid()) and role = 'admin'
    )
    or exists (
      select 1 from course_purchases cp
      where cp.user_id = (select auth.uid())
        and cp.course_id = lessons.course_id
        and cp.refunded_at is null
    )
    or exists (
      select 1
      from subscriptions s
      join courses c on c.id = lessons.course_id
      where s.user_id = (select auth.uid())
        and s.status in ('active', 'trialing')
        and c.year is not null
        and c.month is not null
        and s.current_period_start <=
              (make_date(c.year, c.month, 1) + interval '1 month' - interval '1 second')
        and s.current_period_end >= make_date(c.year, c.month, 1)
    )
  );

-- NOTA: la policy de comments y la nueva de assignments incluyen el mismo
-- filtro — se (re)crean en 2026_07_fix2_security_hardening.sql.

-- Validación:
--   select column_name from information_schema.columns
--   where table_name='course_purchases'
--     and column_name in ('refunded_at','stripe_payment_intent');  → 2 filas
-- Y en el Dashboard de Stripe → Developers → Webhooks → endpoint de prod:
-- añadir los eventos charge.refunded, charge.dispute.created, charge.dispute.closed.
