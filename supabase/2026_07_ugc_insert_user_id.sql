-- HIGH: posts / comments / comment_likes INSERT policies check only
-- `auth.role() = 'authenticated'`, never binding the row's user_id to auth.uid().
-- A user can insert rows with ANOTHER member's user_id via direct PostgREST,
-- spoofing authorship / forging likes. Recreate each policy to bind the owner.
-- (RLS policies for the same command are OR'd, so the permissive policies must be
-- dropped, not merely supplemented.)

-- posts
drop policy if exists "Authenticated users can insert posts." on public.posts;
create policy "Authenticated users can insert posts." on public.posts
  for insert with check ((select auth.uid()) = user_id);

-- comments (community post comments AND lesson comments live in the same table)
-- Drop both existing insert policies since they're OR'd together
drop policy if exists "Authenticated users can insert comments." on public.comments;
drop policy if exists "Authenticated users can create comments" on public.comments;
create policy "Authenticated users can create comments" on public.comments
  for insert with check ((select auth.uid()) = user_id);

-- comment_likes
drop policy if exists "Authenticated users can toggle likes" on public.comment_likes;
create policy "Authenticated users can toggle likes" on public.comment_likes
  for insert with check ((select auth.uid()) = user_id);
