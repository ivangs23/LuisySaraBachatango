-- supabase/2026_05_audit2_rls_comments.sql
-- Gating de SELECT en comments:
-- - Comentarios de community posts (comments.post_id IS NOT NULL): públicos para autenticados.
-- - Comentarios de lesson (comments.lesson_id IS NOT NULL): solo si el user tiene acceso al curso.
--
-- auth.uid() envuelto en (select ...) por advisor 0003 (auth_rls_initplan).

drop policy if exists "Comments are viewable by everyone" on comments;
drop policy if exists "Comments are viewable by everyone." on comments;
drop policy if exists "Comments are viewable by authenticated users." on comments;
drop policy if exists "Comments SELECT: post or accessible-lesson" on comments;

create policy "Comments SELECT: post or accessible-lesson" on comments
  for select using (
    -- Community post comments: any authenticated user can read.
    post_id is not null
    -- Lesson comments: only if user has access to the parent course.
    or (
      lesson_id is not null
      and exists (
        select 1 from lessons l
        where l.id = comments.lesson_id
          and (
            -- Free lesson — anyone can read its comments.
            coalesce(l.is_free, false) = true
            -- Admin
            or exists (
              select 1 from profiles
              where id = (select auth.uid()) and role = 'admin'
            )
            -- Purchase of parent course
            or exists (
              select 1 from course_purchases cp
              where cp.user_id = (select auth.uid())
                and cp.course_id = l.course_id
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
