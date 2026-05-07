-- Guard contra year/month NULL en la rama de subscription del policy.
-- Sin este guard, make_date(NULL, ...) lanza error y aborta el SELECT
-- entero — bloqueando lecciones legítimas a usuarios sin admin/free/purchase.

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
