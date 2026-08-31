-- ============================================================================
-- FIX: la lectura anónima de courses / lessons / events está rota en producción.
--
-- SÍNTOMA (verificado con la anon key contra la BD real, 2026-08-11):
--   courses  -> ERROR: permission denied for table profiles
--   lessons  -> ERROR: permission denied for table profiles
--   events   -> ERROR: permission denied for table profiles
--   posts    -> OK
--   profiles -> OK (columnas sociales)
--
-- Efecto en la app: /curso-bachatango devuelve 404 a todo visitante anónimo
-- (getLandingCourse -> null -> notFound), /courses sale vacío, y sitemap.xml
-- pierde las URLs de curso. Todo el embudo de venta y de SEO, muerto.
--
-- CAUSA: 2026_07_fix2_security_hardening.sql:107-109 revocó a `anon` el SELECT
-- sobre public.profiles y volvió a concederlo solo por columnas, dejando `role`
-- fuera a propósito (para que nadie pudiera enumerar admins con ?role=eq.admin).
-- Ese endurecimiento es correcto y NO se toca aquí.
--
-- Lo que no se revisó entonces: varias policies RLS siguen comprobando el rol
-- con `exists (select 1 from profiles where id = auth.uid() and role='admin')`.
-- PostgreSQL no garantiza cortocircuito en `OR`, así que evalúa esa rama aunque
-- `is_published = true` ya sea cierta. Como `anon` no puede leer `profiles.role`,
-- la evaluación de la policy aborta y se lleva por delante el SELECT entero,
-- incluidas las filas públicas.
--
-- ARREGLO: encapsular la comprobación de admin en una función SECURITY DEFINER.
-- Dentro de la función la consulta corre con los privilegios del propietario, así
-- que `anon` puede evaluarla sin tener acceso directo a `profiles.role`. La función
-- solo devuelve un booleano sobre QUIEN LLAMA, que el propio llamante ya conoce:
-- no filtra nada nuevo y el endurecimiento de julio sigue intacto.
--
-- Idempotente: se puede reejecutar sin daño.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Helper
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
  returns boolean
  language sql
  stable
  security definer
  -- search_path fijado: sin esto, un search_path manipulado por el llamante
  -- podría resolver `profiles` a otra tabla dentro de una función definer.
  set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True si quien llama es admin. SECURITY DEFINER para que las policies RLS puedan comprobar el rol sin conceder a anon SELECT sobre profiles.role.';

-- EXECUTE es PUBLIC por defecto en funciones nuevas; se hace explícito.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2) courses — misma lógica que 2026_07_fix2:163-171, solo cambia el check admin
-- ----------------------------------------------------------------------------
drop policy if exists "Courses are viewable by everyone (published or admin)." on public.courses;
create policy "Courses are viewable by everyone (published or admin)." on public.courses
  for select using (
    coalesce(is_published, false) = true
    or public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 3) lessons — misma lógica que 2026_05_audit4_rls_lessons_null_guard.sql,
--    incluido el guard de year/month NULL. Solo cambia el check admin.
-- ----------------------------------------------------------------------------
drop policy if exists "Lessons SELECT: free, admin, purchased or subscribed." on public.lessons;
create policy "Lessons SELECT: free, admin, purchased or subscribed." on public.lessons
  for select using (
    coalesce(is_free, false) = true
    or public.is_admin()
    or exists (
      select 1 from course_purchases cp
      where cp.user_id = (select auth.uid())
        and cp.course_id = lessons.course_id
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

-- ----------------------------------------------------------------------------
-- 4) events — misma lógica que events.sql:44-75. `events_public_read` por sí
--    sola bastaría, pero las policies permisivas se combinan con OR y basta con
--    que una reviente para tumbar el SELECT entero.
-- ----------------------------------------------------------------------------
drop policy if exists events_admin_read_all on public.events;
create policy events_admin_read_all
  on public.events for select
  using (public.is_admin());

drop policy if exists events_admin_write on public.events;
create policy events_admin_write
  on public.events for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- FUERA DE ALCANCE A PROPÓSITO
--
-- `comments` (2026_07_fix2:40-79) y `assignments` (2026_07_fix2:117-150) tienen
-- el mismo patrón, pero solo se leen con sesión y el rol `authenticated` SÍ
-- conserva `role` en su allowlist de columnas, así que hoy no están rotas.
-- Verificado: no aparecen en el diagnóstico de anon de arriba.
--
-- Migrarlas a public.is_admin() sería mejora de robustez, no corrección de un
-- fallo, y ampliaría el radio de este cambio sobre producción. Se deja para una
-- migración aparte.
-- ============================================================================

-- ============================================================================
-- VALIDACIÓN — ejecutar DESPUÉS de aplicar. Ninguna debe fallar.
--
-- Con solo la anon key (sin sesión), desde `node` o el REST client:
--   GET /rest/v1/courses?select=id,title,price_eur&is_published=eq.true
--     -> debe devolver el curso publicado, NO "permission denied".
--   GET /rest/v1/lessons?select=id&is_free=eq.true       -> filas, no error.
--   GET /rest/v1/events?select=id&is_published=eq.true   -> filas, no error.
--   GET /rest/v1/profiles?select=role
--     -> DEBE SEGUIR FALLANDO con permission denied. Si esto empieza a
--        funcionar, el endurecimiento de julio se ha roto: revertir.
--   GET /rest/v1/courses?select=id&is_published=eq.false -> 0 filas.
--        Un borrador visible para anon significa que la policy quedó mal.
--
-- En la app, sin sesión:
--   /curso-bachatango -> 200 (antes 404)
--   /courses          -> lista el curso publicado
--   /sitemap.xml      -> incluye /courses/<id>
-- ============================================================================
