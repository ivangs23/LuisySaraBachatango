-- 1. Create Enum for Roles
do $$ begin
    create type public.app_role as enum ('member', 'premium', 'admin');
exception
    when duplicate_object then null;
end $$;

-- 2. Add role column to profiles if it doesn't exist
do $$ begin
    alter table public.profiles 
    add column role public.app_role not null default 'member';
exception
    when duplicate_column then null;
end $$;

-- 3. Update RLS for Lessons (Admin can do everything, others read-only)
drop policy if exists "Lessons are viewable by everyone." on lessons;
drop policy if exists "Admins can insert lessons." on lessons;
drop policy if exists "Admins can update lessons." on lessons;
drop policy if exists "Admins can delete lessons." on lessons;

create policy "Lessons are viewable by everyone." on lessons
  for select using (true);

create policy "Admins can insert lessons." on lessons
  for insert with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update lessons." on lessons
  for update using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete lessons." on lessons
  for delete using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 4. Update RLS for Courses (Admin can do everything)
drop policy if exists "Courses are viewable by everyone." on courses;
drop policy if exists "Admins can insert courses." on courses;
drop policy if exists "Admins can update courses." on courses;
drop policy if exists "Admins can delete courses." on courses;

create policy "Courses are viewable by everyone." on courses
  for select using (true);

create policy "Admins can insert courses." on courses
  for insert with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update courses." on courses
  for update using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete courses." on courses
  for delete using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
