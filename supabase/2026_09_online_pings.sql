-- ============================================================================
-- Presencia: cuánta gente hay ahora mismo en la web. Solo un número, solo admin.
--
-- Qué se guarda: el hash de visitante efímero (el mismo de landing_events, sal
-- que cambia a medianoche UTC) y la hora del último latido.
-- Qué NO se guarda: IP, user-agent, user_id, cookie, ni la ruta que está
-- mirando. Con esto solo se puede contar, nunca reconstruir a quién ni a dónde.
--
-- La clave primaria es el hash: cada visitante ocupa UNA fila que se sobrescribe
-- en cada latido. La tabla no crece con el tráfico, crece con los visitantes
-- distintos del día — y el cron de las 04:00 borra lo que ya está frío.
--
-- Idempotente.
-- ============================================================================

create table if not exists public.online_pings (
  visitor_hash text        primary key,
  last_seen    timestamptz not null default now()
);

-- La única consulta que existe es "cuántos con last_seen > corte".
create index if not exists online_pings_last_seen_idx
  on public.online_pings (last_seen desc);

alter table public.online_pings enable row level security;

-- Solo admin lee. `public.is_admin()` es SECURITY DEFINER
-- (2026_08_fix_anon_read_admin_check.sql): comprobar el rol leyendo
-- profiles.role directamente es el patrón que tumbó el embudo en julio.
drop policy if exists "online_pings admin SELECT" on public.online_pings;
create policy "online_pings admin SELECT" on public.online_pings
  for select using (public.is_admin());

-- Nadie escribe con la anon key: los latidos entran con service role desde
-- /api/presence, que es quien filtra bots y calcula el hash. Sin estas dos
-- policies un visitante podría inflar el contador a mano.
drop policy if exists "online_pings no client INSERT" on public.online_pings;
create policy "online_pings no client INSERT" on public.online_pings
  for insert with check (false);

drop policy if exists "online_pings no client UPDATE" on public.online_pings;
create policy "online_pings no client UPDATE" on public.online_pings
  for update using (false);

-- ============================================================================
-- VALIDACIÓN — ejecutar después:
--
--   Con la anon key:  select * from online_pings                → 0 filas o denegado
--   Con la anon key:  insert into online_pings(visitor_hash)    → debe fallar
--   Con la anon key:  update online_pings set last_seen = now() → 0 filas
--   Con sesión admin: select count(*) from online_pings         → funciona
-- ============================================================================
