-- supabase/2026_05_audit_rls_courses.sql
-- Tighten SELECT policy on courses: drafts only visible to admins.

drop policy if exists "Courses are viewable by everyone." on courses;

create policy "Courses are viewable by everyone (published or admin)." on courses
  for select using (
    coalesce(is_published, true) = true
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
