-- LOW: pin search_path on the events updated_at trigger function (defense in
-- depth against search_path hijacking — a function without a pinned
-- search_path resolves unqualified identifiers using the caller's search_path,
-- which a malicious role could manipulate) and scope the comment_likes SELECT
-- policy to authenticated users only (it was previously readable by anyone,
-- including anonymous/unauthenticated requests, via `using (true)`).

-- ---------------------------------------------------------------------------
-- 1. Pin search_path on public.set_events_updated_at()
--    Body copied verbatim from supabase/events.sql; only the
--    `set search_path = public` clause is new.
-- ---------------------------------------------------------------------------
create or replace function public.set_events_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Scope comment_likes SELECT to authenticated users.
--    Was: create policy "Likes are viewable by everyone" on public.comment_likes
--         for select using (true);                        (supabase/comments_setup.sql)
-- ---------------------------------------------------------------------------
drop policy if exists "Likes are viewable by everyone" on public.comment_likes;
create policy "Likes are viewable by authenticated users"
  on public.comment_likes for select
  using (auth.role() = 'authenticated');
