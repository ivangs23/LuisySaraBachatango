-- supabase/2026_05_audit_rls_lessons.sql
-- Replace the permissive SELECT policy with real gating:
-- a user can read a lesson row only if it's free, they're admin,
-- they purchased the parent course, or they have an active/trialing
-- subscription whose period covers the course's month/year.

drop policy if exists "Lessons are viewable by everyone." on lessons;
drop policy if exists "Lessons SELECT: free, admin, purchased or subscribed." on lessons;

-- auth.uid() is wrapped in (select ...) so Postgres evaluates it once per
-- query (init-plan) instead of per row. See Supabase advisor 0003
-- (auth_rls_initplan).
create policy "Lessons SELECT: free, admin, purchased or subscribed." on lessons
  for select using (
    -- Free lesson (preview)
    coalesce(is_free, false) = true
    -- Admin
    or exists (
      select 1 from profiles
      where id = (select auth.uid()) and role = 'admin'
    )
    -- One-time purchase of the parent course
    or exists (
      select 1 from course_purchases cp
      where cp.user_id = (select auth.uid())
        and cp.course_id = lessons.course_id
    )
    -- Active subscription that covers the course's month/year
    or exists (
      select 1
      from subscriptions s
      join courses c on c.id = lessons.course_id
      where s.user_id = (select auth.uid())
        and s.status in ('active', 'trialing')
        and s.current_period_start <=
              (make_date(c.year, c.month, 1) + interval '1 month' - interval '1 second')
        and s.current_period_end >= make_date(c.year, c.month, 1)
    )
  );
