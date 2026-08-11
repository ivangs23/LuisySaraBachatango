-- ============================================================================
-- FIX 3 — desbloquea la lectura anónima de `lessons`.
--
-- DIAGNÓSTICO (verificado con la anon key, 2026-08-11, tras aplicar fix1):
--   courses           OK
--   subscriptions     OK
--   course_purchases  ERROR: permission denied for table profiles   <-- causa
--   lessons           ERROR: permission denied for table profiles
--
-- `lessons` ya tiene UNA sola policy SELECT y usa public.is_admin(), así que
-- no lee `profiles` directamente. Pero su rama de compra hace
--
--     exists (select 1 from course_purchases cp where ...)
--
-- y evaluar esa subconsulta aplica la RLS de `course_purchases`, cuya policy
-- SÍ lee profiles.role. El error se propaga y tumba el SELECT de lessons.
--
-- La policy SELECT de course_purchases no está en ningún fichero de supabase/
-- (existe solo en la BD, creada desde el dashboard o heredada). No se toca
-- aquí: reescribir a ciegas la policy que controla el acceso a contenido de
-- pago es peor que el fallo que arregla.
--
-- ARREGLO: encapsular la comprobación de compra igual que se hizo con la de
-- admin. Dentro de una función SECURITY DEFINER propiedad de `postgres`
-- —dueño de la tabla— la RLS de course_purchases no se evalúa, así que la
-- rama deja de depender de que esa policy funcione. Efecto lateral bueno:
-- una comprobación menos por fila de lessons.
--
-- Esta migración INCLUYE el arreglo de la regresión de reembolsos de fix2, así
-- que si fix2 aún no se ha aplicado, esta lo cubre. Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Helper de compra
-- ----------------------------------------------------------------------------
create or replace function public.has_course_purchase(target_course_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.course_purchases cp
    where cp.user_id = (select auth.uid())
      and cp.course_id = target_course_id
      -- Reembolso = sin acceso (2026_07_fix1_refunds.sql).
      and cp.refunded_at is null
  );
$$;

comment on function public.has_course_purchase(uuid) is
  'True si quien llama tiene una compra no reembolsada de ese curso. SECURITY DEFINER para que la policy de lessons no arrastre la RLS de course_purchases. Usa auth.uid() internamente: el llamante no puede consultar por otro usuario.';

revoke execute on function public.has_course_purchase(uuid) from public;
grant execute on function public.has_course_purchase(uuid) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2) lessons — misma semántica que 2026_07_fix1_refunds.sql:28-53.
--    Cambian solo las dos comprobaciones encapsuladas.
-- ----------------------------------------------------------------------------
drop policy if exists "Lessons SELECT: free, admin, purchased or subscribed." on public.lessons;

create policy "Lessons SELECT: free, admin, purchased or subscribed." on public.lessons
  for select using (
    coalesce(is_free, false) = true
    or public.is_admin()
    or public.has_course_purchase(lessons.course_id)
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

-- ============================================================================
-- PENDIENTE APARTE (no lo arregla esta migración)
--
-- La policy SELECT de `course_purchases` sigue leyendo profiles.role, así que
-- `anon` sigue sin poder leer esa tabla. Hoy no rompe nada —anon no tiene
-- compras y lessons ya no depende de ella— pero es la misma bomba de relojería
-- que causó esto. Para limpiarla hace falta ver su definición:
--
--   select polname, pg_get_expr(polqual, polrelid)
--   from pg_policy where polrelid = 'public.course_purchases'::regclass;
--
-- Con esa definición delante, reescribirla usando public.is_admin().
-- ============================================================================

-- ============================================================================
-- VALIDACIÓN — ejecutar después:
--
--   npx tsx scripts/verify-anon-read.ts     -> las 6 deben pasar
--
-- Y con un usuario REEMBOLSADO (si hay alguno en la BD), comprobar que ya no
-- ve las lecciones del curso: es la condición que fix1 de julio protegía y que
-- 2026_08_fix_anon_read_admin_check.sql había revertido sin querer.
-- ============================================================================
