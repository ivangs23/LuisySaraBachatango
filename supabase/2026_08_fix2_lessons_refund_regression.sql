-- ============================================================================
-- FIX 2 — corrige una regresión introducida por 2026_08_fix_anon_read_admin_check.sql
-- y diagnostica por qué `lessons` sigue denegando la lectura anónima.
--
-- 🔴 REGRESIÓN (aplicar cuanto antes)
--
-- La migración anterior recreó la policy de `lessons` copiándola de
-- 2026_05_audit4_rls_lessons_null_guard.sql. Esa NO era la versión vigente:
-- 2026_07_fix1_refunds.sql la había recreado después añadiendo
-- `and cp.refunded_at is null` a la rama de compra.
--
-- Efecto: quien pidió y obtuvo un reembolso RECUPERA el acceso a las lecciones
-- del curso. El fix de reembolsos de julio quedó revertido sin querer.
--
-- Esta migración restaura esa condición, manteniendo el cambio de
-- public.is_admin() que sí resuelve la lectura anónima.
--
-- Idempotente.
-- ============================================================================

drop policy if exists "Lessons SELECT: free, admin, purchased or subscribed." on public.lessons;

create policy "Lessons SELECT: free, admin, purchased or subscribed." on public.lessons
  for select using (
    coalesce(is_free, false) = true
    -- SECURITY DEFINER: anon no puede leer profiles.role directamente.
    or public.is_admin()
    or exists (
      select 1 from course_purchases cp
      where cp.user_id = (select auth.uid())
        and cp.course_id = lessons.course_id
        -- Restaurado desde 2026_07_fix1_refunds.sql. Sin esta línea, una
        -- compra reembolsada sigue dando acceso.
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

-- ============================================================================
-- DIAGNÓSTICO — ejecutar esta consulta y pegar el resultado.
--
-- `scripts/verify-anon-read.ts` sigue dando "permission denied for table
-- profiles" en lessons después de la migración anterior. Las policies
-- permisivas se combinan con OR y basta con que UNA reviente para tumbar el
-- SELECT entero, así que debe quedar otra policy SELECT (o FOR ALL) sobre
-- lessons que lee profiles.role directamente y que no está en los ficheros
-- de supabase/ (creada desde el dashboard, o heredada de un setup antiguo).
--
-- Esta consulta solo LEE el catálogo. No modifica nada.
-- ============================================================================

select
  polname                                as policy_name,
  case polcmd
    when 'r' then 'SELECT'
    when 'a' then 'INSERT'
    when 'w' then 'UPDATE'
    when 'd' then 'DELETE'
    when '*' then 'ALL'
  end                                    as command,
  polpermissive                          as permissive,
  pg_get_expr(polqual, polrelid)         as using_expression
from pg_policy
where polrelid = 'public.lessons'::regclass
order by command, polname;
