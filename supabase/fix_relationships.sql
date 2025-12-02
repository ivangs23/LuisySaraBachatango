-- 1. Ensure all users have a profile (backfill for existing users)
insert into public.profiles (id, email)
select id, email from auth.users
where id not in (select id from public.profiles);

-- 2. Update Posts table to reference profiles instead of auth.users
alter table posts drop constraint if exists posts_user_id_fkey;
alter table posts add constraint posts_user_id_fkey 
  foreign key (user_id) references profiles(id) on delete cascade;

-- 3. Update Comments table to reference profiles instead of auth.users
alter table comments drop constraint if exists comments_user_id_fkey;
alter table comments add constraint comments_user_id_fkey 
  foreign key (user_id) references profiles(id) on delete cascade;
