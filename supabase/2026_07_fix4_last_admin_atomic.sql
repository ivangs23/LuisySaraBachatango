-- supabase/2026_07_fix4_last_admin_atomic.sql
-- AUDITORIA-2026-07 B8: el guard de "último admin" en updateUserRole hacía
-- COUNT y UPDATE en sentencias separadas (TOCTOU). Dos degradaciones
-- concurrentes podían pasar ambas el `count > 1` y dejar 0 admins.
--
-- Esta función serializa las degradaciones con `FOR UPDATE` sobre las filas
-- admin: la segunda transacción bloquea hasta que la primera commitea y
-- entonces ve el recuento ya reducido.

create or replace function public.set_user_role(target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  admin_count int;
  target_role text;
begin
  if new_role not in ('member', 'premium', 'admin') then
    raise exception 'invalid_role';
  end if;

  if new_role <> 'admin' then
    -- Bloquea las filas admin para serializar degradaciones concurrentes.
    select count(*) into admin_count from public.profiles where role = 'admin' for update;
    select role into target_role from public.profiles where id = target;
    if target_role = 'admin' and admin_count <= 1 then
      raise exception 'last_admin';
    end if;
  end if;

  update public.profiles set role = new_role where id = target;
end;
$$;

-- Solo el service role (server actions admin) la ejecuta; nunca anon/authenticated.
revoke all on function public.set_user_role(uuid, text) from public;
revoke all on function public.set_user_role(uuid, text) from anon, authenticated;
grant execute on function public.set_user_role(uuid, text) to service_role;

-- Validación:
--   Simular dos degradaciones concurrentes (dos sesiones psql, BEGIN;
--   select set_user_role(...) en ambas antes de COMMIT) → la segunda espera y
--   luego falla con 'last_admin' si solo quedaba un admin.
