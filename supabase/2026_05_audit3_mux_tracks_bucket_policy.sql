-- Documents the storage policies on the `mux-track-sources` bucket as they
-- already exist in production (verified 2026-05-07). Re-running this file is
-- idempotent: each policy is created only if missing.
--
-- Effect:
--   - Public SELECT: anyone can fetch a track URL (Mux fetches the object
--     by URL when adding a text track to an asset).
--   - INSERT and DELETE restricted to users with profiles.role = 'admin'.
--   - No UPDATE policy → service role only.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins insert mux-track-sources'
  ) then
    create policy "Admins insert mux-track-sources" on storage.objects
      for insert
      with check (
        bucket_id = 'mux-track-sources'
        and exists (
          select 1 from public.profiles
          where id = (select auth.uid()) and role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins delete mux-track-sources'
  ) then
    create policy "Admins delete mux-track-sources" on storage.objects
      for delete
      using (
        bucket_id = 'mux-track-sources'
        and exists (
          select 1 from public.profiles
          where id = (select auth.uid()) and role = 'admin'
        )
      );
  end if;
end $$;
