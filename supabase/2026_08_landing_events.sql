-- ============================================================================
-- Eventos de la landing: vistas de página sin cookies ni datos personales.
--
-- Por qué no GA4: está detrás del banner de consentimiento, así que solo cuenta
-- a quien acepta (50-70% del tráfico), y no puede cruzarse con course_purchases.
--
-- Qué se guarda: la ruta, un hash de visitante que caduca cada día, y la fecha.
-- Qué NO se guarda: IP, user-agent, user_id, cookie. El hash se calcula en
-- servidor con una sal que cambia a diario y las entradas se descartan.
--
-- Idempotente.
-- ============================================================================

create table if not exists public.landing_events (
  id           bigserial   primary key,
  path         text        not null,
  visitor_hash text        not null,
  created_at   timestamptz not null default now()
);

create index if not exists landing_events_created_at_idx
  on public.landing_events (created_at desc);

create index if not exists landing_events_path_created_idx
  on public.landing_events (path, created_at desc);

alter table public.landing_events enable row level security;

-- Solo admin lee. `public.is_admin()` es SECURITY DEFINER
-- (2026_08_fix_anon_read_admin_check.sql): comprobar el rol leyendo
-- profiles.role directamente es el patrón que tumbó el embudo en julio.
drop policy if exists "landing_events admin SELECT" on public.landing_events;
create policy "landing_events admin SELECT" on public.landing_events
  for select using (public.is_admin());

-- Nadie inserta con la anon key: las escrituras van con service role desde
-- /api/landing-event, que es quien valida la ruta y calcula el hash.
drop policy if exists "landing_events no client INSERT" on public.landing_events;
create policy "landing_events no client INSERT" on public.landing_events
  for insert with check (false);

-- ============================================================================
-- VALIDACIÓN — ejecutar después:
--
--   Con la anon key:  select * from landing_events            → 0 filas o denegado
--   Con la anon key:  insert into landing_events(...)         → debe fallar
--   Con sesión admin: select count(*) from landing_events     → funciona
-- ============================================================================
