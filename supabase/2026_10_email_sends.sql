-- ============================================================================
-- Secuencias de email: qué paso de qué secuencia se ha enviado a quién.
-- Plan de marketing de octubre 2026, T3.3.
--
-- Lo escribe solo el cron /api/cron/lifecycle-emails, con service role. La
-- fila se inserta ANTES de enviar: el `unique` hace que dos ejecuciones
-- solapadas no manden dos veces el mismo correo. Si el envío falla, el cron
-- borra la fila para reintentarlo en la siguiente ejecución.
--
-- Qué se guarda: el email (para casar con newsletter_subscribers), la
-- secuencia, el paso y cuándo. Nada más.
--
-- Aditiva e idempotente.
-- ============================================================================

create table if not exists public.email_sends (
  id       uuid        primary key default gen_random_uuid(),
  email    text        not null,
  sequence text        not null,
  step     int         not null,
  sent_at  timestamptz not null default now(),
  unique (email, sequence, step)
);

-- RLS sin policies: con la anon key o una sesión de alumno no se lee ni se
-- escribe nada. Solo el service role, que se salta la RLS.
alter table public.email_sends enable row level security;

-- ============================================================================
-- VALIDACIÓN — ejecutar después:
--
--   select relrowsecurity from pg_class where oid = 'public.email_sends'::regclass;  → true
--   select count(*) from pg_policy where polrelid = 'public.email_sends'::regclass;   → 0
--   Con la anon key:  select * from email_sends                → 0 filas o denegado
--   Con la anon key:  insert into email_sends(email, sequence, step)
--                     values ('x@x.com', 'nutricion', 2)       → debe fallar
-- ============================================================================
