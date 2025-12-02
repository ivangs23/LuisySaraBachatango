-- 1. Create Enum for Video Source
do $$ begin
    create type public.video_source as enum ('url', 'upload');
exception
    when duplicate_object then null;
end $$;

-- 2. Alter lessons table
alter table public.lessons 
add column if not exists duration integer, -- in seconds
add column if not exists is_free boolean default false,
add column if not exists video_source public.video_source default 'url',
add column if not exists attachments jsonb default '[]'::jsonb;

-- 3. Create Storage Buckets (if they don't exist)
-- Note: This requires permissions to insert into storage.buckets
insert into storage.buckets (id, name, public)
values ('course-content', 'course-content', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- 4. Storage Policies for 'course-content' (Private, only authenticated users can view, admins can upload)
create policy "Authenticated users can view course content"
on storage.objects for select
using ( bucket_id = 'course-content' and auth.role() = 'authenticated' );

create policy "Admins can upload course content"
on storage.objects for insert
with check (
  bucket_id = 'course-content' and 
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

create policy "Admins can update course content"
on storage.objects for update
using (
  bucket_id = 'course-content' and 
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

create policy "Admins can delete course content"
on storage.objects for delete
using (
  bucket_id = 'course-content' and 
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

-- 5. Storage Policies for 'thumbnails' (Public view, admins upload)
create policy "Anyone can view thumbnails"
on storage.objects for select
using ( bucket_id = 'thumbnails' );

create policy "Admins can upload thumbnails"
on storage.objects for insert
with check (
  bucket_id = 'thumbnails' and 
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

create policy "Admins can update thumbnails"
on storage.objects for update
using (
  bucket_id = 'thumbnails' and 
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

create policy "Admins can delete thumbnails"
on storage.objects for delete
using (
  bucket_id = 'thumbnails' and 
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);
