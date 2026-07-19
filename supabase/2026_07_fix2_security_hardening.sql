-- supabase/2026_07_fix2_security_hardening.sql
-- Cierres de seguridad de AUDITORIA-2026-07 (M1, M2, M3, B5, B9, B10).
-- Aplicar a mano en el SQL Editor de Supabase (prod), bloque a bloque,
-- DESPUÉS de 2026_07_fix1_refunds.sql (este fichero referencia
-- course_purchases.refunded_at, creada allí).
-- Queries de validación al final.

-- ============================================================================
-- M1: un alumno podía auto-calificarse vía INSERT directo por PostgREST.
-- 2026_07_submissions_grade_lockdown.sql cerró UPDATE pero el grant de INSERT
-- por defecto (todas las columnas, incl. grade/feedback/status) seguía vivo y
-- la policy de INSERT solo comprobaba ownership.
-- Mismo patrón que el lockdown de UPDATE: revoke + grant de columnas.
-- submitAssignment upserta {assignment_id, user_id, text_content, file_url,
-- status, updated_at} — exactamente estas columnas deben estar en el grant
-- (PostgREST .upsert() genera INSERT ... ON CONFLICT DO UPDATE; el privilegio
-- INSERT se comprueba sobre las columnas del payload).
-- ============================================================================
revoke insert on public.submissions from anon, authenticated;
grant insert (assignment_id, user_id, text_content, file_url, status, updated_at)
  on public.submissions to authenticated;
-- grade y feedback quedan fuera: solo los escribe el service role (gradeSubmission).

-- Cinturón y tirantes: pinnear status en la policy de INSERT para que tampoco
-- se pueda insertar directamente con status='reviewed'.
drop policy if exists "Users can insert own submissions" on public.submissions;
create policy "Users can insert own submissions" on public.submissions
  for insert with check ((select auth.uid()) = user_id and status = 'pending');

-- ============================================================================
-- M2: los comentarios del foro (post_id IS NOT NULL) eran legibles por anon:
-- la rama post de la policy SELECT no exigía autenticación y anon conserva el
-- grant SELECT por defecto. Los posts sí exigen auth (community_setup.sql) —
-- el foro es solo-miembros. Ninguna página pública renderiza comentarios
-- (la página de lección exige login), así que anon no necesita SELECT en absoluto.
-- ============================================================================
revoke select on public.comments from anon;

drop policy if exists "Comments SELECT: post or accessible-lesson" on comments;
create policy "Comments SELECT: post or accessible-lesson" on comments
  for select using (
    -- Community post comments: only authenticated users can read.
    ( post_id is not null and (select auth.uid()) is not null )
    -- Lesson comments: only if user has access to the parent course.
    or (
      lesson_id is not null
      and exists (
        select 1 from lessons l
        where l.id = comments.lesson_id
          and (
            -- Free lesson — any logged-in user can read its comments.
            ( coalesce(l.is_free, false) = true and (select auth.uid()) is not null )
            -- Admin
            or exists (
              select 1 from profiles
              where id = (select auth.uid()) and role = 'admin'
            )
            -- Purchase of parent course (not refunded)
            or exists (
              select 1 from course_purchases cp
              where cp.user_id = (select auth.uid())
                and cp.course_id = l.course_id
                and cp.refunded_at is null
            )
            -- Active sub covering course month/year
            or exists (
              select 1
              from subscriptions s
              join courses c on c.id = l.course_id
              where s.user_id = (select auth.uid())
                and s.status in ('active', 'trialing')
                and s.current_period_start <=
                      (make_date(c.year, c.month, 1) + interval '1 month' - interval '1 second')
                and s.current_period_end >= make_date(c.year, c.month, 1)
          )
        )
      )
    )
  );

-- B9b: integridad — un comentario debe pertenecer a un post O a una lección,
-- nunca a ambos ni a ninguno. NOT VALID para no fallar si existen filas legacy;
-- comprobar con la query de validación (abajo) y luego ejecutar el VALIDATE.
alter table public.comments
  add constraint comments_post_xor_lesson
  check (num_nonnulls(post_id, lesson_id) = 1) not valid;
-- Tras verificar que no hay filas huérfanas:
-- alter table public.comments validate constraint comments_post_xor_lesson;

-- ============================================================================
-- M3: escalada de rol latente. El lockdown de julio revocó UPDATE sobre
-- profiles.role, pero el grant de INSERT por defecto cubría todas las columnas
-- y la policy de INSERT solo pide auth.uid() = id. Si a un usuario le faltase
-- su fila de profiles (fallo de handle_new_user, backfill), podría insertarse
-- con role='admin'. Los perfiles solo los crea el trigger handle_new_user
-- (SECURITY DEFINER, no le afectan los grants) o el service role.
-- ============================================================================
revoke insert on public.profiles from anon, authenticated;

-- ============================================================================
-- B5: `role` estaba en el allowlist SELECT de anon — cualquiera con la anon
-- key podía enumerar qué cuentas son admin (?role=eq.admin). Se mantienen las
-- columnas sociales porque el Footer público las lee sin sesión
-- (components/Footer.tsx). `authenticated` conserva su allowlist actual
-- (incluye role, que la UI condicional sí usa con sesión).
-- ============================================================================
revoke select on public.profiles from anon;
grant select (id, full_name, avatar_url, updated_at, instagram, facebook, tiktok, youtube)
  on public.profiles to anon;

-- ============================================================================
-- B9: assignments era legible por cualquier autenticado — enunciados de cursos
-- de pago visibles sin compra + enumeración de IDs (el vector del M1).
-- Mismo gating de acceso que los comentarios de lección.
-- assignments tiene course_id directo, así que el check es más simple.
-- ============================================================================
drop policy if exists "Authenticated users can view assignments" on public.assignments;
create policy "Assignments SELECT: course access required" on public.assignments
  for select using (
    -- Admin
    exists (
      select 1 from profiles
      where id = (select auth.uid()) and role = 'admin'
    )
    -- La lección es gratuita
    or exists (
      select 1 from lessons l
      where l.id = assignments.lesson_id
        and coalesce(l.is_free, false) = true
        and (select auth.uid()) is not null
    )
    -- Compra del curso (no reembolsada)
    or exists (
      select 1 from course_purchases cp
      where cp.user_id = (select auth.uid())
        and cp.course_id = assignments.course_id
        and cp.refunded_at is null
    )
    -- Suscripción activa cubriendo el mes/año del curso
    or exists (
      select 1
      from subscriptions s
      join courses c on c.id = assignments.course_id
      where s.user_id = (select auth.uid())
        and s.status in ('active', 'trialing')
        and s.current_period_start <=
              (make_date(c.year, c.month, 1) + interval '1 month' - interval '1 second')
        and s.current_period_end >= make_date(c.year, c.month, 1)
    )
  );

-- ============================================================================
-- B10: la policy de courses usaba coalesce(is_published, true) — un NULL
-- explícito publicaba un borrador. Primero preservamos el comportamiento
-- visible (NULL era tratado como publicado), luego endurecemos el default.
-- ============================================================================
update public.courses set is_published = true where is_published is null;
alter table public.courses alter column is_published set not null;
alter table public.courses alter column is_published set default false;

-- Recrear la policy con coalesce a false (defensa si el NOT NULL se relajara).
-- Copiada de 2026_05_audit_rls_courses.sql cambiando solo el coalesce.
drop policy if exists "Courses are viewable by everyone (published or admin)." on public.courses;
create policy "Courses are viewable by everyone (published or admin)." on public.courses
  for select using (
    coalesce(is_published, false) = true
    or exists (
      select 1 from profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

-- ============================================================================
-- VALIDACIÓN (ejecutar tras aplicar; ninguna debe fallar)
-- ============================================================================
-- 1) Con un JWT de member vía PostgREST:
--    POST /rest/v1/submissions {"assignment_id":"...","user_id":"<self>","grade":"10"}
--    → debe fallar 42501 (permission denied for column grade).
--    POST con {"status":"reviewed"} → violación de policy.
--    submitAssignment normal (texto+URL) → debe seguir funcionando.
-- 2) Solo anon key: GET /rest/v1/comments?select=content&post_id=not.is.null
--    → 0 filas / permission denied.
-- 3) Solo anon key: GET /rest/v1/profiles?select=role → permission denied;
--    GET /rest/v1/profiles?select=full_name,instagram → sigue OK (Footer).
-- 4) JWT de member sin compras: GET /rest/v1/assignments?select=title → 0 filas.
-- 5) select count(*) from comments where num_nonnulls(post_id, lesson_id) <> 1;
--    → si 0, ejecutar el VALIDATE CONSTRAINT comentado arriba.
-- 6) El registro de un usuario nuevo sigue creando su fila de profiles
--    (handle_new_user es SECURITY DEFINER; el revoke de INSERT no le afecta).
