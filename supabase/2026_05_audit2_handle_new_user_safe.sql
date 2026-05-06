-- supabase/2026_05_audit2_handle_new_user_safe.sql
-- Don't trust avatar_url from raw_user_meta_data on signup.
-- Accepting it here lets a malicious signup payload set arbitrary URLs
-- (tracking pixels, SSRF target via Next/Image optimizer if hostname
-- happens to match remotePatterns). Users update avatar from profile UI
-- after authentication, with sanitization.
--
-- Also pin search_path = public to clear advisor 0011 (function_search_path_mutable).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
